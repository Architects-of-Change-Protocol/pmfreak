export const PMFREAK_AOC_GOVERNED_ACTION_GATE_ID = "pmfreak.integration.aoc.governed_action_gate.v1" as const;

export const PMFREAK_AOC_GOVERNED_ACTION_GATE_NAME = "PMFreak AOC Governed Action Gate v1" as const;

export const PMFREAK_AOC_GOVERNED_ACTION_GATE_VERSION = "v1" as const;

export const PMFREAK_AOC_GOVERNED_ACTION_GATE_CAPABILITIES = {
  evaluateGovernanceResponse: "evaluate_governance_response",
  evaluateDecisionInboxItem: "evaluate_decision_inbox_item",
  evaluateActionAttempt: "evaluate_action_attempt",
  createGateResult: "create_gate_result",
  createGateDetailViewModel: "create_gate_detail_view_model",
  summarizeGateResults: "summarize_gate_results",
  batchEvaluateGateResults: "batch_evaluate_gate_results",
  renderSafeGateModel: "render_safe_gate_model",
} as const;

export const PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS = [
  "execute_action",
  "run_action",
  "apply_decision",
  "auto_apply_decision",
  "mutate_project",
  "update_project",
  "delete_project",
  "create_task",
  "update_task",
  "delete_task",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "update_schedule",
  "close_risk",
  "attach_evidence",
  "approve_action",
  "send_client_communication",
  "send_email",
  "post_to_slack",
  "create_invoice",
  "writeback_decision",
  "enforce_with_mutation",
  "certify_invoice_validity",
  "certify_customer_acceptance",
  "certify_compliance",
] as const;

// Subset of PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS that the
// no-execution guard rejects. Kept as a distinct list (rather than reusing
// the combined list above) so an execution-only caller and a
// mutation-only caller each get a guard scoped to their own concern.
export const PMFREAK_AOC_GOVERNED_ACTION_GATE_EXECUTION_FORBIDDEN_OPERATIONS = [
  "execute_action",
  "run_action",
  "apply_decision",
  "auto_apply_decision",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "send_client_communication",
  "create_invoice",
] as const;

// Subset of PMFREAK_AOC_GOVERNED_ACTION_GATE_FORBIDDEN_OPERATIONS that the
// no-mutation guard rejects.
export const PMFREAK_AOC_GOVERNED_ACTION_GATE_MUTATION_FORBIDDEN_OPERATIONS = [
  "mutate_project",
  "update_project",
  "delete_project",
  "create_task",
  "update_task",
  "delete_task",
  "update_schedule",
  "close_risk",
  "attach_evidence",
  "approve_action",
  "writeback_decision",
] as const;

// A superset of these (plus a few decision/verdict vocabulary phrases)
// doubles as the false-positive corpus for claim-safety checks in
// pmfreak-aoc-governed-action-gate-claim-safety.ts.
export const PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS = [
  "PMFreak consumes AOC Governance",
  "AOC governed action gate",
  "Gate only",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No decision writeback performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
] as const;

export const PMFREAK_AOC_GOVERNED_ACTION_GATE_DISCLAIMERS = [
  "This feature evaluates whether a proposed PMFreak action passes the AOC governance gate.",
  "This feature consumes PMFreak AOC governance responses and/or decision inbox items.",
  "This feature returns gate results.",
  "This feature does not execute PMFreak actions.",
  "This feature does not mutate PMFreak data.",
  "This feature does not write decisions back.",
  "This feature does not send communications.",
  "This feature does not create invoices.",
  "This feature does not certify compliance.",
  "This feature does not certify customer acceptance.",
  "This feature does not certify invoice validity.",
  "This feature does not provide legal advice.",
] as const;
