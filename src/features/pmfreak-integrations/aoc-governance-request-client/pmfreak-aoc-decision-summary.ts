import type { PMFreakAocGovernanceDecision, PMFreakAocGovernanceDecisionSeverity, PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";

const NEXT_STEPS: Record<PMFreakAocGovernanceDecision, string> = {
  allow: "AOC governance response indicates this request context was allowed. Do not treat this as proof of production execution.",
  deny: "Do not proceed with this attempted action under the current request context.",
  hold: "Wait for a further governance signal before attempting this action again.",
  require_evidence: "Provide or link the missing evidence references before attempting execution.",
  require_billing_review: "Provide the required billing review signal before attempting the billing-sensitive action.",
  require_pm_approval: "Provide the required PM approval signal before attempting execution.",
  require_customer_validation: "Provide the required customer validation signal before attempting execution.",
  require_contract_review: "Provide the required contract review signal before attempting execution.",
  require_security_review: "Provide the required security review signal before attempting execution.",
  require_executive_approval: "Provide the required executive approval signal before attempting execution.",
};

export type PMFreakAocGovernanceDecisionSummary = {
  decision: PMFreakAocGovernanceDecision;
  decisionLabel: string;
  severity: PMFreakAocGovernanceDecisionSeverity;
  summary: string;
  nextStep: string;
  safeLabels: string[];
};

export function createPMFreakAocGovernanceDecisionSummary(
  response: PMFreakAocGovernanceResponse,
): PMFreakAocGovernanceDecisionSummary {
  return {
    decision: response.decision,
    decisionLabel: response.decisionLabel,
    severity: response.decisionSeverity,
    summary: response.safeSummary,
    nextStep: NEXT_STEPS[response.decision],
    safeLabels: [...response.safeLabels],
  };
}
