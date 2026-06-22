// ─────────────────────────────────────────────────────────────────────────────
// Signal Recommendation Engine
//
// Associates detected signals with relevant constitutional recommendations.
// Mapping is driven by signal type → recommendation type affinity.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { GovernanceSignalType, GovernanceSignalResult } from "./types";
import { dbCreateSignalRecommendation } from "./governance-signal-repository";

// Signal type → recommendation type affinities (ordered by priority)
const SIGNAL_RECOMMENDATION_AFFINITY: Record<GovernanceSignalType, string[]> = {
  approval_delay:        ["ratification_control", "decision_guidance"],
  authority_gap:         ["authority_control", "governance_control"],
  escalation_gap:        ["authority_control", "governance_control"],
  decision_bottleneck:   ["decision_guidance", "ratification_control"],
  amendment_backlog:     ["amendment_guidance", "governance_control"],
  ratification_stall:    ["ratification_control", "amendment_guidance"],
  risk_accumulation:     ["risk_mitigation", "governance_control"],
  recommendation_ignored:["governance_control", "delivery_improvement"],
  governance_violation:  ["governance_control", "authority_control"],
  delivery_drift:        ["delivery_improvement", "risk_mitigation"],
};

export type RecommendationLink = {
  recommendationId: string;
  recommendationKey: string;
  recommendationType: string;
  confidenceScore: number;
};

export async function generateSignalRecommendations(input: {
  workspaceId: string;
  signalId: string;
  signalType: GovernanceSignalType;
}): Promise<GovernanceSignalResult<RecommendationLink[]>> {
  const affinityTypes = SIGNAL_RECOMMENDATION_AFFINITY[input.signalType] ?? [];
  if (affinityTypes.length === 0) return { ok: true, data: [] };

  const supabase = await createSupabaseServerClient();
  const cols = CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");

  const { data, error } = await supabase
    .from("constitutional_recommendations")
    .select(cols)
    .eq("workspace_id", input.workspaceId)
    .in("recommendation_type", affinityTypes)
    .in("status", ["published", "validated"])
    .order("confidence_score", { ascending: false })
    .limit(5);

  if (error) {
    return { ok: false, error: "Unable to query recommendations.", failureClass: "persistence_failed" };
  }

  const recommendations = (data ?? []) as unknown as Array<{
    id: string;
    recommendation_key: string;
    recommendation_type: string;
    confidence_score: number;
  }>;

  const links: RecommendationLink[] = [];

  for (const rec of recommendations) {
    // Confidence is boosted for higher-priority affinity types
    const affinityIndex = affinityTypes.indexOf(rec.recommendation_type);
    const affinityBoost = affinityIndex === 0 ? 0.10 : 0.05;
    const confidenceScore = Math.min(1.0, rec.confidence_score + affinityBoost);

    const result = await dbCreateSignalRecommendation({
      workspaceId: input.workspaceId,
      signalId: input.signalId,
      recommendationId: rec.id,
      confidenceScore,
    });

    if (result.ok) {
      links.push({
        recommendationId: rec.id,
        recommendationKey: rec.recommendation_key,
        recommendationType: rec.recommendation_type,
        confidenceScore,
      });
    }
  }

  return { ok: true, data: links };
}
