export const PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID = "pmfreak.integration.aoc.decision_display_inbox.v1" as const;

export const PMFREAK_AOC_DECISION_DISPLAY_INBOX_NAME = "PMFreak AOC Decision Display / Inbox v1" as const;

export const PMFREAK_AOC_DECISION_DISPLAY_INBOX_VERSION = "v1" as const;

export const PMFREAK_AOC_DECISION_INBOX_CAPABILITIES = {
  normalizeGovernanceResponse: "normalize_governance_response",
  createInboxItem: "create_inbox_item",
  createDecisionDetailViewModel: "create_decision_detail_view_model",
  filterInboxItems: "filter_inbox_items",
  sortInboxItems: "sort_inbox_items",
  groupInboxItems: "group_inbox_items",
  summarizeInboxItems: "summarize_inbox_items",
  renderSafeDisplayModel: "render_safe_display_model",
} as const;

export const PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS = [
  "execute_action",
  "apply_decision",
  "enforce_decision",
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
  "certify_invoice_validity",
  "certify_customer_acceptance",
  "certify_compliance",
] as const;

// A superset of these (plus a few decision vocabulary phrases) doubles as
// the false-positive corpus for claim-safety checks in
// pmfreak-aoc-decision-inbox-claim-safety.ts.
export const PMFREAK_AOC_DECISION_INBOX_SAFE_LABELS = [
  "PMFreak consumes AOC Governance",
  "AOC decision display",
  "AOC decision inbox",
  "Display only",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No decision writeback performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
] as const;

export const PMFREAK_AOC_DECISION_INBOX_DISCLAIMERS = [
  "This feature displays AOC governance decisions inside PMFreak.",
  "This feature creates display/inbox view models from governance responses.",
  "This feature does not execute PMFreak actions.",
  "This feature does not mutate PMFreak data.",
  "This feature does not write decisions back.",
  "This feature does not send communications.",
  "This feature does not create invoices.",
  "This feature does not enforce decisions.",
  "This feature does not certify compliance.",
  "This feature does not certify customer acceptance.",
  "This feature does not certify invoice validity.",
  "This feature does not provide legal advice.",
] as const;

export const PMFREAK_AOC_DECISION_INBOX_DEFAULT_MAX_ITEMS = 100;
