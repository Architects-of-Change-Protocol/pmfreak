import type { ProjectOSAttentionType } from "@/lib/db/database-contract";
import type { OperationalPriority } from "@/lib/db/database-contract";

// ─── Rationale Engine ─────────────────────────────────────────────────────────
//
// Generates human-readable, explainable rationale for why a focus item
// requires attention. Every focus item must have an explainable rationale
// (Principle 3: Todo foco debe ser explicable).

const RATIONALE_TEMPLATES: Record<ProjectOSAttentionType, (priority: OperationalPriority) => string> = {
  authority_gap: (p) =>
    `This item is ${p} priority because an unresolved authority gap blocks ratification and may prevent governance actions from being executed. Without clear authority, decisions lack legitimacy and downstream work cannot proceed.`,

  ratification_stall: (p) =>
    `This item is ${p} priority because a ratification stall means the constitutional framework lacks the signatures required for legitimacy. Governance decisions made without ratification may be contested or reversed.`,

  governance_violation: (p) =>
    `This item is ${p} priority because an active governance violation represents a breach of established constitutional rules. Unresolved violations erode trust and may escalate into more severe governance failures.`,

  critical_signal: (p) =>
    `This item is ${p} priority because a critical governance signal has been detected that requires immediate attention. Critical signals indicate systemic risk that, if left unaddressed, may cascade into execution and governance failures.`,

  overdue_commitment: (p) =>
    `This item is ${p} priority because a commitment has passed its due date without completion. Overdue commitments signal execution risk and may trigger breach-of-commitment escalation if not addressed promptly.`,

  execution_drift: (p) =>
    `This item is ${p} priority because execution has drifted significantly from the approved plan. Persistent drift indicates that the projection model no longer reflects reality and must be reconciled.`,

  projection_variance: (p) =>
    `This item is ${p} priority because a significant variance has been detected between projected and actual execution data. High variance degrades forecast reliability and may require projection revision.`,

  ignored_recommendation: (p) =>
    `This item is ${p} priority because an active recommendation is being ignored. Consistently ignoring recommendations reduces the value of the intelligence layer and may result in avoidable project risks.`,

  low_health_score: (p) =>
    `This item is ${p} priority because the overall operating health score has fallen below the acceptable threshold. Low health indicates compounding issues across governance, execution, or memory domains that require holistic review.`,
};

export function generateFocusRationale(
  attentionType: ProjectOSAttentionType,
  priority: OperationalPriority
): string {
  const template = RATIONALE_TEMPLATES[attentionType];
  return template(priority);
}
