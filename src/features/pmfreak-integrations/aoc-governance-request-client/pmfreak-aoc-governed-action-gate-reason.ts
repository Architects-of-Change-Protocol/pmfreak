import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateReasonCode } from "./pmfreak-aoc-governed-action-gate-types";

const DECISION_TO_REASON_CODE: Record<PMFreakAocGovernanceDecision, PMFreakAocGovernedActionGateReasonCode> = {
  allow: "aoc_allow",
  deny: "aoc_deny",
  hold: "aoc_hold",
  require_evidence: "aoc_requires_evidence",
  require_pm_approval: "aoc_requires_pm_approval",
  require_customer_validation: "aoc_requires_customer_validation",
  require_billing_review: "aoc_requires_billing_review",
  require_contract_review: "aoc_requires_contract_review",
  require_security_review: "aoc_requires_security_review",
  require_executive_approval: "aoc_requires_executive_approval",
};

export type PMFreakAocGateReasonCodesInput = {
  decision?: PMFreakAocGovernanceDecision;
  validationErrors?: string[];
  mismatchedRequestId?: boolean;
  mismatchedClientId?: boolean;
  unsafeClaim?: boolean;
};

// Deterministic reason-code derivation. A decision drives exactly one base
// reason code; missing/unrecognized decisions fall back to
// missing_governance_response / unknown_decision respectively, and any
// mismatch/validation/claim-safety flags append additional codes.
export function createPMFreakAocGateReasonCodes(input: PMFreakAocGateReasonCodesInput): PMFreakAocGovernedActionGateReasonCode[] {
  const codes: PMFreakAocGovernedActionGateReasonCode[] = [];

  if (input.decision && input.decision in DECISION_TO_REASON_CODE) {
    codes.push(DECISION_TO_REASON_CODE[input.decision]);
  } else if (input.decision) {
    codes.push("unknown_decision");
  } else {
    codes.push("missing_governance_response");
  }

  if (input.mismatchedRequestId) {
    codes.push("mismatched_request_id");
  }
  if (input.mismatchedClientId) {
    codes.push("mismatched_client_id");
  }
  if (input.unsafeClaim) {
    codes.push("unsafe_claim");
  }
  if (input.validationErrors && input.validationErrors.length > 0) {
    codes.push("invalid_gate_input");
  }

  return codes;
}
