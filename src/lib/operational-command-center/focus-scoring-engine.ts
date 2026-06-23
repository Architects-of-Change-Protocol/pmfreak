import type { ProjectOSAttentionType, ProjectOSAttentionSeverity } from "@/lib/db/database-contract";

// ─── Focus Scoring Engine ─────────────────────────────────────────────────────
//
// Calculates a 0–100 focus score for an attention item based on:
//   • Attention Severity
//   • Source Criticality (attention type)
//   • Health Impact
//   • Time Sensitivity
//   • Blocker Effect
//   • Recommendation Confidence

type FocusScoreInput = {
  attentionSeverity: ProjectOSAttentionSeverity;
  attentionType: ProjectOSAttentionType;
  operatingHealthScore: number;
  recommendationConfidence?: number; // 0–1
};

const SEVERITY_BASE: Record<ProjectOSAttentionSeverity, number> = {
  critical: 40,
  high:     28,
  medium:   16,
  low:       8,
};

const SOURCE_CRITICALITY_BONUS: Record<ProjectOSAttentionType, number> = {
  authority_gap:           20, // blocks ratification and execution
  ratification_stall:      18, // blocks governance legitimacy
  governance_violation:    16, // active breach of governance
  critical_signal:         15, // detected critical governance signal
  overdue_commitment:      12, // commitment already past due
  execution_drift:         10, // execution has drifted from plan
  projection_variance:      8, // projection accuracy degraded
  ignored_recommendation:   5, // recommendation being ignored
  low_health_score:         6, // overall project health degraded
};

// Types that act as upstream blockers for downstream work
const BLOCKER_TYPES = new Set<ProjectOSAttentionType>([
  "authority_gap",
  "ratification_stall",
  "governance_violation",
  "critical_signal",
]);

export function calculateFocusScore(input: FocusScoreInput): number {
  const severityBase   = SEVERITY_BASE[input.attentionSeverity];
  const sourceCriticality = SOURCE_CRITICALITY_BONUS[input.attentionType];

  // Health impact: the worse the project health, the higher the urgency (+0–15)
  const healthImpact = Math.round((1 - input.operatingHealthScore / 100) * 15);

  // Time sensitivity: critical and high severity items carry extra time pressure
  const timeSensitivity = input.attentionSeverity === "critical" ? 8
    : input.attentionSeverity === "high" ? 4
    : 0;

  // Blocker effect: items that block other work get a bonus
  const blockerEffect = BLOCKER_TYPES.has(input.attentionType) ? 5 : 0;

  // Recommendation confidence: low confidence increases score (less is known, more risk)
  const confidence = input.recommendationConfidence ?? 0.5;
  const confidenceComponent = Math.round((1 - confidence) * 4);

  const raw = severityBase + sourceCriticality + healthImpact + timeSensitivity + blockerEffect + confidenceComponent;
  return Math.max(0, Math.min(100, raw));
}
