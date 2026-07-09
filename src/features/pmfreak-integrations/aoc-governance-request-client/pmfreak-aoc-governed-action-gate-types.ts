export type PMFreakAocGovernedActionGateVerdict =
  | "passed"
  | "blocked"
  | "held"
  | "needs_evidence"
  | "needs_approval"
  | "needs_review"
  | "error";

export type PMFreakAocGovernedActionGateSeverity = "success" | "info" | "warning" | "danger";

export type PMFreakAocGovernedActionGateReasonCode =
  | "aoc_allow"
  | "aoc_deny"
  | "aoc_hold"
  | "aoc_requires_evidence"
  | "aoc_requires_pm_approval"
  | "aoc_requires_customer_validation"
  | "aoc_requires_billing_review"
  | "aoc_requires_contract_review"
  | "aoc_requires_security_review"
  | "aoc_requires_executive_approval"
  | "missing_governance_response"
  | "mismatched_request_id"
  | "mismatched_client_id"
  | "unsafe_claim"
  | "invalid_gate_input"
  | "unknown_decision";

export type PMFreakAocGovernedActionGateTraceStep = {
  stepId: string;
  label: string;
  status: "passed" | "warning" | "blocked" | "not_applicable";
  summary: string;
};

// Where a gate input/result was sourced from. Shared by the config's
// `defaultSource`, the gate input's `source`, and the batch/evaluator
// dispatch logic.
export type PMFreakAocGovernedActionGateSource = "governance_response" | "decision_inbox_item" | "action_attempt";
