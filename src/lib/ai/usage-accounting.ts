// Perilla 11 — AI cost/usage accounting.
//
// Every inference call routed through src/lib/ai/providers/router.ts records
// one row in public.ai_usage_events (provider, model, workspace, user,
// operation, tokens, estimated cost, status, duration). Recording is
// best-effort and never throws into the caller: losing an accounting row must
// not fail a user request. Without Supabase service-role env (local dev,
// tests) the recorder is a no-op and the daily cost reader returns null.
//
// The daily cost ceiling reads back the day's summed estimated cost; when the
// read is unavailable or errors, the ceiling check FAILS OPEN (the durable
// fail-closed bound is the daily request ceiling through the abuse store) —
// see docs/release/beta-release-closure-summary.md for the rationale.

import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/env";
import { createPrivilegedSupabaseClient } from "@/lib/security/privileged-access";

export type AiUsageRecord = {
  provider: string;
  model: string;
  workspaceId?: string;
  userId?: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  /** USD; null when the provider returned no usage or the model is unpriced. */
  estimatedCostUsd: number | null;
  status: "success" | "error" | "timeout" | "blocked";
  durationMs?: number;
};

// Indicative per-1M-token USD prices for cost *estimation* (ceilings and
// reporting), not billing. Unknown models record null cost — visible in the
// accounting table as "unpriced" rather than silently estimated at zero.
const MODEL_PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-4.1": { input: 2.0, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

export function estimateCostUsd(model: string, inputTokens?: number, outputTokens?: number): number | null {
  const price = MODEL_PRICES_PER_MILLION[model];
  if (!price) return null;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return null;
  const inputCost = ((inputTokens ?? 0) / 1_000_000) * price.input;
  const outputCost = ((outputTokens ?? 0) / 1_000_000) * price.output;
  return Number((inputCost + outputCost).toFixed(6));
}

type UsageClient = {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): {
      eq(column: string, value: string): {
        gte(
          column: string,
          value: string,
        ): PromiseLike<{ data: Array<{ estimated_cost_usd: number | null }> | null; error: { message: string } | null }>;
      };
    };
  };
};

function getDefaultClient(): UsageClient | null {
  if (!hasSupabaseServiceRoleEnv) return null;
  return createPrivilegedSupabaseClient({
    routeId: "lib.ai.usage-accounting",
    operation: "record_ai_usage",
    reason: "ai_cost_accounting",
    systemActor: "system",
  }) as unknown as UsageClient;
}

export async function recordAiUsage(record: AiUsageRecord, getClient: () => UsageClient | null = getDefaultClient): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    const { error } = await client.from("ai_usage_events").insert({
      provider: record.provider,
      model: record.model,
      workspace_id: record.workspaceId ?? null,
      user_id: record.userId ?? null,
      operation: record.operation,
      input_tokens: record.inputTokens ?? null,
      output_tokens: record.outputTokens ?? null,
      estimated_cost_usd: record.estimatedCostUsd,
      status: record.status,
      duration_ms: record.durationMs ?? null,
    });
    if (error) {
      console.warn("[ai-usage] record_failed", { operation: record.operation, error: error.message });
    }
  } catch (error) {
    console.warn("[ai-usage] record_failed", { operation: record.operation, error: error instanceof Error ? error.message : "unknown" });
  }
}

/**
 * Sum of today's (UTC day) estimated cost for a workspace, in USD.
 * Returns null when accounting is unavailable (no service-role env) or the
 * read fails — callers treat null as "cannot evaluate ceiling" (fail open).
 */
export async function getWorkspaceDailyCostUsd(
  workspaceId: string,
  getClient: () => UsageClient | null = getDefaultClient,
): Promise<number | null> {
  try {
    const client = getClient();
    if (!client) return null;
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { data, error } = await client
      .from("ai_usage_events")
      .select("estimated_cost_usd")
      .eq("workspace_id", workspaceId)
      .gte("created_at", dayStart.toISOString());
    if (error || !data) return null;
    return data.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
  } catch {
    return null;
  }
}
