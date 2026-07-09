import type { PMFreakAocGovernanceDecision, PMFreakAocGovernanceDecisionSeverity } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocDecisionInboxSeverity } from "./pmfreak-aoc-decision-inbox-types";

const DECISION_TO_SEVERITY: Partial<Record<PMFreakAocGovernanceDecision, PMFreakAocDecisionInboxSeverity>> = {
  allow: "success",
  deny: "danger",
  hold: "warning",
  require_evidence: "warning",
  require_pm_approval: "warning",
  require_customer_validation: "warning",
  require_billing_review: "warning",
  require_contract_review: "warning",
  require_security_review: "warning",
  require_executive_approval: "warning",
};

const KNOWN_RESPONSE_SEVERITIES: readonly PMFreakAocDecisionInboxSeverity[] = ["success", "info", "warning", "danger"];

export function mapPMFreakAocDecisionToInboxSeverity(
  decision: PMFreakAocGovernanceDecision,
  responseSeverity?: PMFreakAocGovernanceDecisionSeverity,
): PMFreakAocDecisionInboxSeverity {
  const mapped = DECISION_TO_SEVERITY[decision];
  if (mapped) {
    return mapped;
  }

  if (responseSeverity && (KNOWN_RESPONSE_SEVERITIES as readonly string[]).includes(responseSeverity)) {
    return responseSeverity as PMFreakAocDecisionInboxSeverity;
  }

  return "info";
}
