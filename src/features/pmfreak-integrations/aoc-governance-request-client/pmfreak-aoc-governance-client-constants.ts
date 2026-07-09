export const PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID =
  "pmfreak.integration.aoc.governance_request_client.v1" as const;

export const PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_NAME =
  "PMFreak AOC Governance Request Client v1" as const;

export const PMFREAK_SYSTEM_ID = "pmfreak" as const;

export const AOC_GOVERNANCE_SYSTEM_ID = "aoc" as const;

export const PMFREAK_AOC_GOVERNANCE_CLIENT_CAPABILITIES = {
  buildGovernanceRequest: "build_governance_request",
  validateGovernanceRequest: "validate_governance_request",
  evaluateGovernanceRequest: "evaluate_governance_request",
  receiveGovernanceDecision: "receive_governance_decision",
  summarizeGovernanceDecision: "summarize_governance_decision",
} as const;

export const PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS = [
  "execute_action",
  "apply_decision",
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
  "send_client_communication",
  "send_email",
  "post_to_slack",
  "create_invoice",
  "approve_action",
  "writeback_decision",
  "certify_invoice_validity",
  "certify_customer_acceptance",
  "certify_compliance",
] as const;

// The descriptor's safe-label set. A superset of these (plus a few decision
// vocabulary phrases) doubles as the false-positive corpus for claim-safety
// checks in pmfreak-aoc-claim-safety.ts.
export const PMFREAK_AOC_GOVERNANCE_SAFE_LABELS = [
  "PMFreak consumes AOC Governance",
  "AOC governance request client",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
] as const;

export const PMFREAK_AOC_GOVERNANCE_CLIENT_DISCLAIMERS = [
  "This client lets PMFreak build and evaluate AOC governance requests.",
  "This client receives AOC governance decisions.",
  "This client does not execute PMFreak actions.",
  "This client does not mutate PMFreak data.",
  "This client does not write back decisions.",
  "This client does not send communications.",
  "This client does not create invoices.",
  "This client does not certify compliance.",
  "This client does not certify customer acceptance.",
  "This client does not certify invoice validity.",
  "This client does not provide legal advice.",
] as const;

export const PMFREAK_AOC_GOVERNANCE_DEFAULT_TIMEOUT_MS = 5000;

export const PMFREAK_AOC_GOVERNANCE_DEFAULT_MAX_PAYLOAD_SIZE_KB = 256;
