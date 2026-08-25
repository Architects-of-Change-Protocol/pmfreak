import { evaluateAIEgressPolicy } from "@/lib/governance/authority/runtime/ai-egress/policy-engine";
import type { AIEgressRequest, DataSensitivity } from "@/lib/governance/authority/runtime/ai-egress/types";
import type { InferenceRequest, InferenceResponse } from "@/lib/ai/inference/types";
import { recordAIEgressDecision } from "@/lib/aoc/audit/ai-egress-audit";
import { getProviderMetadata } from "@/lib/ai/providers/provider-registry";
import { runProviderInference } from "@/lib/ai/providers/router";

export async function runInferenceGateway(request: InferenceRequest): Promise<InferenceResponse> {
  const providerId = ((request.metadata?.provider as string | undefined) ?? process.env.DEFAULT_AI_PROVIDER ?? "openai").toLowerCase();

  const egressRequest = buildAIEgressRequest(request, providerId);
  const providerMetadata = getProviderMetadata(providerId);
  if (!providerMetadata) {
    const denial = { decision: "deny", reason: `Provider metadata missing for '${providerId}'.`, enforcementLevel: "hard", auditRequired: true } as const;
    recordAIEgressDecision(egressRequest, denial);
    throw new Error("Inference policy denied.");
  }

  const decision = evaluateAIEgressPolicy(egressRequest, providerMetadata);
  recordAIEgressDecision(egressRequest, decision);
  if (decision.decision === "deny") {
    throw new Error("Inference policy denied.");
  }

  // TODO(ai-egress): Inject tenant/workspace policy overlays and regional constraints here.
  return runProviderInference(request);
}

export function buildAIEgressRequest(request: InferenceRequest, providerId: string): AIEgressRequest {
  return {
    actor: {
      actorId: request.actorId ?? "unknown",
      actorType: "user",
    },
    provider: providerId,
    model: request.modelPreference,
    workspaceId: request.workspaceId,
    projectId: request.projectId,
    moduleId: request.moduleId ?? (request.metadata?.moduleId as string | undefined),
    estimatedSensitivity: normalizeSensitivity(request.metadata?.estimatedSensitivity),
    dataClasses: Array.isArray(request.metadata?.dataClasses) ? (request.metadata?.dataClasses as string[]) : undefined,
    messageCount: request.messages.length,
    tokenEstimate: typeof request.metadata?.tokenEstimate === "number" ? (request.metadata.tokenEstimate as number) : undefined,
    purpose: request.moduleId,
  };
}

function normalizeSensitivity(value: unknown): DataSensitivity | undefined {
  if (value === "public" || value === "internal" || value === "confidential" || value === "restricted") {
    return value;
  }
  return undefined;
}
