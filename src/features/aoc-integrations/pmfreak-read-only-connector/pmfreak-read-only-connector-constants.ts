// AOC PMFreak Read-Only Connector v1 — constants
//
// This connector is a read-only integration boundary. It reads PMFreak
// data and normalizes it into AOC-safe connector snapshots. It does not
// govern actions, resolve passports, run scenarios, build Control Plane
// views, build Narrative Exports, or write back to PMFreak.

export const AOC_PMFREAK_READ_ONLY_CONNECTOR_ID = "aoc.integration.pmfreak.read_only_connector.v1" as const;

export const AOC_PMFREAK_READ_ONLY_CONNECTOR_NAME = "AOC PMFreak Read-Only Connector v1" as const;

export const AOC_PMFREAK_SYSTEM_ID = "pmfreak" as const;

export const AOC_PMFREAK_READ_ONLY_CONNECTOR_CAPABILITIES = {
  readProjects: "read_projects",
  readAgents: "read_agents",
  readMilestones: "read_milestones",
  readTasks: "read_tasks",
  readRisks: "read_risks",
  readEvidenceReferences: "read_evidence_references",
  readApprovalReferences: "read_approval_references",
  readActionProposals: "read_action_proposals",
} as const;

export const AOC_PMFREAK_FORBIDDEN_CONNECTOR_OPERATIONS = [
  "create_project",
  "update_project",
  "delete_project",
  "create_task",
  "update_task",
  "delete_task",
  "create_milestone",
  "update_milestone",
  "delete_milestone",
  "create_risk",
  "update_risk",
  "delete_risk",
  "create_evidence_reference",
  "update_evidence_reference",
  "delete_evidence_reference",
  "create_approval_reference",
  "update_approval_reference",
  "delete_approval_reference",
  "create_invoice",
  "send_email",
  "send_slack_message",
  "send_client_communication",
  "approve_action",
  "execute_action",
  "writeback_decision",
] as const;

export const AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS = [
  "read-only connector",
  "read-only PMFreak data",
  "No mutation performed",
  "No writeback performed",
  "Not production execution",
  "Not compliance certification",
  "No invoice validity claimed",
  "No customer acceptance certification",
] as const;

export const AOC_PMFREAK_READ_ONLY_CONNECTOR_DISCLAIMERS = [
  "This connector reads PMFreak data.",
  "This connector does not mutate PMFreak data.",
  "This connector does not execute actions.",
  "This connector does not create governance decisions.",
  "This connector does not send communications.",
  "This connector does not create invoices.",
  "This connector does not certify compliance.",
  "This connector does not provide legal advice.",
] as const;

// Lowercase, for substring matching in assertNoAocPMFreakReadOnlyConnectorOverclaim.
export const AOC_PMFREAK_READ_ONLY_CONNECTOR_PROHIBITED_OVERCLAIM_PHRASES = [
  "fully trusted agent",
  "certified enterprise compliant",
  "risk-free execution",
  "production authorized",
  "invoice-ready certified",
  "invoice ready certified",
  "customer acceptance certified",
  "contractually compliant",
  "legally approved",
  "compliance passed",
  "guaranteed billing",
  "certified audit export",
  "legal evidence package",
  "costa rica compliant",
  "cr compliant",
  "invoice validity certified",
  "billing entitlement guaranteed",
  "customer acceptance legally sufficient",
  "project compliant",
  "production connector certified",
  "write access enabled",
  "mutation allowed",
  "certified pmfreak connector",
] as const;
