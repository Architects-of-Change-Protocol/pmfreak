import type { DecisionSupport, ConsequenceSeverity, ConsequenceImpactHorizon } from "./types";

type FocusMeta = {
  focusItemId: string;
  focusType: string;
  recommendedActionType: string | null;
  blockedEntityCount: number;
  escalationProbability: number;
  severity: ConsequenceSeverity;
  impactHorizon: ConsequenceImpactHorizon;
  impactScore: number;
};

const ACTION_LABELS: Record<string, string> = {
  create_delegation:         "Create a formal delegation to close the authority gap",
  resolve_governance_issue:  "Resolve the governance violation and update the policy record",
  close_ratification:        "Complete the pending ratification to unblock downstream commitments",
  deliver_commitment:        "Deliver the overdue commitment to restore execution alignment",
  review_projection:         "Review and recalibrate the projection against current realities",
  address_execution_drift:   "Intervene in execution drift before it reaches the next milestone",
  review_reality:            "Reconcile the reality record with the current projection baseline",
  review_recommendation:     "Act on the pending recommendation before it loses effectiveness",
  mitigate_risk:             "Mitigate the identified risk before it converts to an active incident",
  restore_health:            "Investigate and restore health signals across the affected entities",
};

const TYPE_TO_ACTION: Record<string, string> = {
  authority:      "create_delegation",
  governance:     "resolve_governance_issue",
  ratification:   "close_ratification",
  commitment:     "deliver_commitment",
  projection:     "review_projection",
  execution:      "address_execution_drift",
  reality:        "review_reality",
  recommendation: "review_recommendation",
  risk:           "mitigate_risk",
  health:         "restore_health",
};

// ─── generateDecisionSupport ──────────────────────────────────────────────────

export function generateDecisionSupport(meta: FocusMeta): DecisionSupport {
  const actionKey     = TYPE_TO_ACTION[meta.focusType] ?? meta.recommendedActionType ?? "review";
  const actionLabel   = ACTION_LABELS[actionKey] ?? `Address the ${meta.focusType.replace(/_/g, " ")} focus item`;
  const escPct        = Math.round(meta.escalationProbability * 100);

  const rationale =
    `A ${meta.severity} ${meta.focusType.replace(/_/g, " ")} focus item (impact score: ${meta.impactScore}) ` +
    `will affect ${meta.blockedEntityCount} entities if left unresolved within ${meta.impactHorizon}. ` +
    `Escalation probability is ${escPct}%. Immediate action is recommended: ${actionLabel}.`;

  return {
    focusItemId:           meta.focusItemId,
    focusType:             meta.focusType,
    recommendedAction:     actionLabel,
    impactIfIgnored:       meta.severity,
    blockedEntityCount:    meta.blockedEntityCount,
    escalationProbability: meta.escalationProbability,
    impactHorizon:         meta.impactHorizon,
    rationale,
  };
}
