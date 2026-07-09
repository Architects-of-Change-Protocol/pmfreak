import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocDecisionInboxDecisionStatus } from "./pmfreak-aoc-decision-inbox-types";

const DECISION_TO_STATUS: Record<PMFreakAocGovernanceDecision, PMFreakAocDecisionInboxDecisionStatus> = {
  allow: "allowed",
  deny: "blocked",
  hold: "held",
  require_evidence: "needs_evidence",
  require_pm_approval: "needs_pm_approval",
  require_customer_validation: "needs_customer_validation",
  require_billing_review: "needs_billing_review",
  require_contract_review: "needs_contract_review",
  require_security_review: "needs_security_review",
  require_executive_approval: "needs_executive_approval",
};

export function mapPMFreakAocDecisionToInboxStatus(decision: PMFreakAocGovernanceDecision): PMFreakAocDecisionInboxDecisionStatus {
  return DECISION_TO_STATUS[decision] ?? "unknown";
}
