export const PMFREAK_AOC_GATE_RESULT_UI_ID = "pmfreak.integration.aoc.gate_result_ui.v1" as const;

export const PMFREAK_AOC_GATE_RESULT_UI_NAME = "PMFreak AOC Gate Result UI v1" as const;

export const PMFREAK_AOC_GATE_RESULT_UI_VERSION = "v1" as const;

export const PMFREAK_AOC_GATE_RESULT_UI_CAPABILITIES = {
  createDisplayModel: "create_display_model",
  createBannerViewModel: "create_banner_view_model",
  createCardViewModel: "create_card_view_model",
  createDetailPanelViewModel: "create_detail_panel_view_model",
  createBlockerViewModel: "create_blocker_view_model",
  createRequirementListViewModel: "create_requirement_list_view_model",
  createTraceViewModel: "create_trace_view_model",
  createSafetyDisclaimerViewModel: "create_safety_disclaimer_view_model",
  renderSafeGateResult: "render_safe_gate_result",
} as const;

export const PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS = [
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

// Subset of PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS that the
// no-action guard rejects. Mirrors the split used by
// pmfreak-aoc-governed-action-gate-constants.ts so an action-only caller
// and a mutation-only caller each get a guard scoped to their own concern.
export const PMFREAK_AOC_GATE_RESULT_UI_ACTION_FORBIDDEN_OPERATIONS = [
  "execute_action",
  "run_action",
  "apply_decision",
  "auto_apply_decision",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "send_client_communication",
  "send_email",
  "post_to_slack",
  "create_invoice",
] as const;

// Subset of PMFREAK_AOC_GATE_RESULT_UI_FORBIDDEN_OPERATIONS that the
// no-mutation guard rejects.
export const PMFREAK_AOC_GATE_RESULT_UI_MUTATION_FORBIDDEN_OPERATIONS = [
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

export const PMFREAK_AOC_GATE_RESULT_UI_SAFE_LABELS = [
  "PMFreak consumes AOC Governance",
  "AOC gate result UI",
  "Presentation only",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No decision writeback performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
] as const;

export const PMFREAK_AOC_GATE_RESULT_UI_DISCLAIMERS = [
  "This feature renders PMFreak AOC governed action gate results.",
  "This feature consumes PMFreak AOC gate results.",
  "This feature creates UI-safe view models for gate result presentation.",
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
