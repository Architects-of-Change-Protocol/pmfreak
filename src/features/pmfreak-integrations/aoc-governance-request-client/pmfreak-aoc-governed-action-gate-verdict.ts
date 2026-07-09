import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateSeverity, PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";

const DECISION_TO_VERDICT: Record<PMFreakAocGovernanceDecision, PMFreakAocGovernedActionGateVerdict> = {
  allow: "passed",
  deny: "blocked",
  hold: "held",
  require_evidence: "needs_evidence",
  require_pm_approval: "needs_approval",
  require_customer_validation: "needs_review",
  require_billing_review: "needs_review",
  require_contract_review: "needs_review",
  require_security_review: "needs_review",
  require_executive_approval: "needs_approval",
};

export function mapPMFreakAocDecisionToGateVerdict(
  decision: PMFreakAocGovernanceDecision | undefined,
): PMFreakAocGovernedActionGateVerdict {
  if (!decision) {
    return "error";
  }
  return DECISION_TO_VERDICT[decision] ?? "error";
}

const VERDICT_TO_SEVERITY: Record<PMFreakAocGovernedActionGateVerdict, PMFreakAocGovernedActionGateSeverity> = {
  passed: "success",
  blocked: "danger",
  held: "warning",
  needs_evidence: "warning",
  needs_approval: "warning",
  needs_review: "warning",
  error: "danger",
};

export function mapPMFreakAocGateVerdictToSeverity(
  verdict: PMFreakAocGovernedActionGateVerdict,
): PMFreakAocGovernedActionGateSeverity {
  return VERDICT_TO_SEVERITY[verdict];
}
