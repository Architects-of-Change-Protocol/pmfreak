import { openAIProvider, isOpenAIProviderConfigured } from "@/lib/ai/providers/openai-provider";
import type { InferenceProvider, InferenceRequest, InferenceResponse } from "@/lib/ai/inference/types";
import { InferenceError } from "@/lib/ai/inference/types";
import { resolveAiRuntimeLimits } from "@/lib/ai/runtime-limits";
import {
  AiGuardrailError,
  assertChainDepthAllowed,
  providerCircuitBreaker,
  workspaceConcurrencyGate,
} from "@/lib/ai/runtime-guardrails";
import { estimateCostUsd, getWorkspaceDailyCostUsd, recordAiUsage } from "@/lib/ai/usage-accounting";
import { enforceAbuseLimit } from "@/lib/security/abuse-protection";
import { buildRoutingContext, resolveProviderCandidates } from "./provider-candidate-resolver";
import { evaluateProviderEgress } from "./egress-policy";
import { emitRoutingAudit, emitRoutingFallback } from "./routing-audit";
import {
  getRegisteredProviders,
  isProviderRegistered,
  isProviderConfigured,
  getProviderHealth,
  setProviderAvailabilityResolver,
} from "./provider-registry";

export { getRegisteredProviders, isProviderRegistered, isProviderConfigured, getProviderHealth };

const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL ?? "gpt-4.1-mini";

// Per-module model overrides; resolved once at startup from env.
const MODULE_MODEL_MAP: Record<string, string> = {
  "meta-intelligence": process.env.OPENAI_META_INTELLIGENCE_MODEL ?? DEFAULT_MODEL,
  "message-nudges": process.env.OPENAI_MESSAGE_NUDGES_MODEL ?? DEFAULT_MODEL,
};

const providerRegistry = new Map<string, InferenceProvider>([
  ["openai", openAIProvider],
  // Future providers registered here:
  // ["anthropic", anthropicProvider],
  // ["gemini", geminiProvider],
  // ["local", localProvider],
]);

// Inject availability into the capability registry so routing decisions are accurate.
// API key checks live in each provider adapter; the registry queries via this resolver.
setProviderAvailabilityResolver((id) => {
  if (id === "openai") return isOpenAIProviderConfigured() ? "enabled" : "not_configured";
  if (id === "mock") return "enabled";
  // anthropic, gemini, local: adapters not yet registered
  return providerRegistry.has(id) ? "enabled" : "not_configured";
});

export function resolveProvider(moduleId?: string): InferenceProvider {
  // Future: consult module registry or policy engine for per-module routing.
  // For now, route everything through the configured default provider.
  void moduleId;
  const providerId = process.env.DEFAULT_AI_PROVIDER ?? "openai";
  const provider = providerRegistry.get(providerId);
  if (!provider) {
    throw new InferenceError(
      `AI provider "${providerId}" is not registered. Available providers: ${[...providerRegistry.keys()].join(", ")}`,
      "unknown",
      providerId,
    );
  }
  return provider;
}

export function resolveModelForModule(moduleId?: string): string {
  return (moduleId && MODULE_MODEL_MAP[moduleId]) ?? DEFAULT_MODEL;
}

export function registerProvider(provider: InferenceProvider): void {
  providerRegistry.set(provider.id, provider);
}

/**
 * Perilla 11 guardrails, enforced here because every inference path (gateway
 * modules, copilot, analyze-ai) converges on runInference:
 *
 *  - agent-chain depth is bounded (AI_MAX_CHAIN_DEPTH);
 *  - per-workspace daily request ceiling (AI_DAILY_REQUEST_LIMIT) through the
 *    fail-closed abuse store;
 *  - per-workspace daily estimated-cost ceiling (AI_DAILY_COST_LIMIT_USD),
 *    fail-open when accounting is unavailable;
 *  - per-workspace concurrency bound (AI_MAX_CONCURRENT_PER_WORKSPACE);
 *  - per-provider circuit breaker (fail fast while a provider is down);
 *  - timeout/attempt defaults from AI_REQUEST_TIMEOUT_MS / AI_MAX_RETRIES
 *    when the caller did not set tighter ones;
 *  - every call records an ai_usage_events accounting row (best-effort).
 */
export async function runInference(request: InferenceRequest): Promise<InferenceResponse> {
  const limits = resolveAiRuntimeLimits();
  const operation = request.operationName ?? request.moduleId ?? "inference";
  const startedAt = Date.now();
  const recordOutcome = (status: "success" | "error" | "timeout" | "blocked", response?: InferenceResponse, providerId = "none") =>
    recordAiUsage({
      provider: response?.provider ?? providerId,
      model: response?.model ?? request.modelPreference ?? resolveModelForModule(request.moduleId),
      workspaceId: request.workspaceId,
      userId: request.actorId,
      operation,
      inputTokens: response?.usage?.inputTokens,
      outputTokens: response?.usage?.outputTokens,
      estimatedCostUsd: response ? estimateCostUsd(response.model, response.usage?.inputTokens, response.usage?.outputTokens) : null,
      status,
      durationMs: Date.now() - startedAt,
    });

  try {
    assertChainDepthAllowed(request.chainDepth, limits.maxChainDepth);

    if (request.workspaceId) {
      const daily = await enforceAbuseLimit({
        scope: "ai.workspace_daily_requests",
        identifier: request.workspaceId,
        limit: limits.dailyWorkspaceRequestLimit,
        windowSeconds: 24 * 60 * 60,
      });
      if (!daily.allowed) {
        throw new AiGuardrailError(
          `Workspace reached its daily AI request ceiling (${limits.dailyWorkspaceRequestLimit}/day).`,
          "daily_request_ceiling",
        );
      }

      const spentUsd = await getWorkspaceDailyCostUsd(request.workspaceId);
      if (spentUsd !== null && spentUsd >= limits.dailyWorkspaceCostLimitUsd) {
        throw new AiGuardrailError(
          `Workspace reached its daily AI cost ceiling ($${limits.dailyWorkspaceCostLimitUsd.toFixed(2)}).`,
          "daily_cost_ceiling",
        );
      }
    }
  } catch (error) {
    if (error instanceof AiGuardrailError) await recordOutcome("blocked");
    throw error;
  }

  const releaseConcurrency = request.workspaceId
    ? (() => {
        try {
          return workspaceConcurrencyGate.acquire(request.workspaceId, limits.maxConcurrentPerWorkspace);
        } catch (error) {
          if (error instanceof AiGuardrailError) void recordOutcome("blocked");
          throw error;
        }
      })()
    : null;

  try {
    const response = await executeInference(request, limits);
    providerCircuitBreaker.recordSuccess(response.provider);
    await recordOutcome("success", response);
    return response;
  } catch (error) {
    const status =
      error instanceof AiGuardrailError ? "blocked" : error instanceof InferenceError && error.errorClass === "timeout" ? "timeout" : "error";
    await recordOutcome(status, undefined, error instanceof InferenceError ? error.provider : "none");
    throw error;
  } finally {
    releaseConcurrency?.();
  }
}

async function executeInference(request: InferenceRequest, limits: ReturnType<typeof resolveAiRuntimeLimits>): Promise<InferenceResponse> {
  const context = buildRoutingContext(request);
  const candidates = resolveProviderCandidates(context);

  const allowedCandidates: Array<{ candidate: (typeof candidates)[0]; requiresAudit: boolean }> = [];
  const rejectedCandidates: Array<{ providerId: string; reason: string }> = [];

  for (const candidate of candidates) {
    const egress = evaluateProviderEgress(candidate.metadata, context.dataSensitivity, context.routingMode);
    if (egress.allowed) {
      allowedCandidates.push({ candidate, requiresAudit: egress.requiresAudit ?? false });
    } else {
      rejectedCandidates.push({ providerId: candidate.providerId, reason: egress.reason });
    }
  }

  if (allowedCandidates.length === 0) {
    throw new InferenceError(
      `No approved provider available for this request. Candidates evaluated: [${candidates.map((c) => c.providerId).join(", ") || "none"}]. Rejected: [${rejectedCandidates.map((r) => `${r.providerId}(${r.reason})`).join(", ") || "none"}].`,
      "unknown",
      "none",
    );
  }

  const resolvedRequest: InferenceRequest = {
    ...request,
    modelPreference: request.modelPreference ?? resolveModelForModule(request.moduleId),
    // Callers may set tighter bounds; anything unset falls back to the
    // centralized env-configurable limits so no call is ever unbounded.
    timeoutMs: request.timeoutMs ?? limits.requestTimeoutMs,
    maxAttempts: request.maxAttempts ?? limits.maxAttempts,
  };

  const primaryProviderId = allowedCandidates[0].candidate.providerId;
  let lastError: unknown;

  const limit = context.allowFallback ? allowedCandidates.length : 1;

  for (let i = 0; i < limit; i++) {
    const { candidate, requiresAudit } = allowedCandidates[i];
    const provider = providerRegistry.get(candidate.providerId);

    if (!provider) {
      // Adapter not yet registered for this provider (e.g. anthropic, gemini, local).
      rejectedCandidates.push({ providerId: candidate.providerId, reason: "provider_adapter_not_registered" });
      continue;
    }

    // Fail fast while this provider's circuit is open (repeated failures /
    // timeout spikes / exhausted quota) instead of burning another attempt.
    try {
      providerCircuitBreaker.assertCallAllowed(candidate.providerId);
    } catch (error) {
      lastError = error;
      rejectedCandidates.push({ providerId: candidate.providerId, reason: "circuit_open" });
      continue;
    }

    const fallbackUsed = i > 0;
    if (fallbackUsed) {
      emitRoutingFallback(
        allowedCandidates[i - 1].candidate.providerId,
        candidate.providerId,
        lastError instanceof Error ? lastError.message : "unknown_error",
        { module: context.moduleId, routingMode: context.routingMode },
      );
    }

    try {
      const result = await provider.complete(resolvedRequest);

      emitRoutingAudit({
        timestamp: new Date().toISOString(),
        selectedProvider: primaryProviderId,
        routingMode: context.routingMode,
        fallbackUsed,
        finalProvider: candidate.providerId,
        rejectedProviders: rejectedCandidates,
        module: context.moduleId,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        actorType: context.actorType,
        dataSensitivity: context.dataSensitivity,
        requiresAudit,
      });

      return result;
    } catch (error) {
      providerCircuitBreaker.recordFailure(candidate.providerId);
      lastError = error;
    }
  }

  throw lastError ?? new InferenceError("All approved providers failed.", "unknown", "none");
}

// Alias kept for inference-gateway.ts and any callers that reference this name.
export const runProviderInference = runInference;
