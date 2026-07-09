export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_ID =
  "pmfreak.integration.aoc.remote_governance_transport.v1" as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_NAME =
  "PMFreak AOC Remote Governance Transport v1" as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_ENDPOINT_PATH =
  "/api/aoc/pmfreak/governance/evaluate" as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_SHARED_SECRET_HEADER_NAME =
  "x-aoc-governance-secret" as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CAPABILITIES = {
  serializeGovernanceRequest: "serialize_governance_request",
  sendGovernanceRequest: "send_governance_request",
  parseGovernanceResponse: "parse_governance_response",
  validateGovernanceResponse: "validate_governance_response",
  mapAocResponseToPMFreakResponse: "map_aoc_response_to_pmfreak_response",
} as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_FORBIDDEN_OPERATIONS = [
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

// A superset of these (plus a few decision vocabulary phrases) doubles as
// the false-positive corpus for claim-safety checks in
// pmfreak-aoc-remote-governance-claim-safety.ts.
export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS = [
  "PMFreak consumes AOC Governance",
  "AOC remote governance transport",
  "Governance decision received",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No decision writeback performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
] as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_DISCLAIMERS = [
  "This transport sends PMFreak governance requests to AOC.",
  "This transport receives governed AOC decisions.",
  "This transport does not execute PMFreak actions.",
  "This transport does not mutate PMFreak data.",
  "This transport does not write back decisions.",
  "This transport does not send communications.",
  "This transport does not create invoices.",
  "This transport does not certify compliance.",
  "This transport does not certify customer acceptance.",
  "This transport does not certify invoice validity.",
  "This transport does not provide legal advice.",
] as const;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_TIMEOUT_MS = 5000;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_DEFAULT_MAX_PAYLOAD_SIZE_KB = 256;
