import type { ProjectOSAttentionType } from "@/lib/db/database-contract";

// ─── Owner Recommendation Engine ─────────────────────────────────────────────
//
// Recommends the appropriate owner type for resolving a focus item.
// Owner types are role-based, not user-specific — the Command Center
// does not assign individuals, only role categories.

const OWNER_MAP: Record<ProjectOSAttentionType, string> = {
  authority_gap:           "sponsor",
  ratification_stall:      "sponsor",
  governance_violation:    "governance_board",
  critical_signal:         "governance_board",
  overdue_commitment:      "commitment_owner",
  execution_drift:         "project_manager",
  projection_variance:     "project_manager",
  ignored_recommendation:  "project_manager",
  low_health_score:        "project_manager",
};

export function recommendFocusOwner(attentionType: ProjectOSAttentionType): string {
  return OWNER_MAP[attentionType];
}
