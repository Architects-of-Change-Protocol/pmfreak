import type { ProjectOSAttentionType } from "@/lib/db/database-contract";

// ─── Intervention Mapping Engine ──────────────────────────────────────────────
//
// Maps an attention type to a recommended intervention action type.
// The Command Center never executes actions — it only recommends them.

const INTERVENTION_MAP: Record<ProjectOSAttentionType, string> = {
  authority_gap:           "create_delegation",
  ratification_stall:      "request_ratification",
  governance_violation:    "initiate_governance_review",
  critical_signal:         "escalate_signal",
  overdue_commitment:      "breach_commitment",
  execution_drift:         "review_projection",
  projection_variance:     "review_execution_reality",
  ignored_recommendation:  "reactivate_recommendation",
  low_health_score:        "initiate_health_review",
};

export function mapFocusToIntervention(attentionType: ProjectOSAttentionType): string {
  return INTERVENTION_MAP[attentionType];
}
