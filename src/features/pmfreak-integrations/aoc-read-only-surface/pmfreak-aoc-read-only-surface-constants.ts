// PMFreak AOC Read-Only Integration Surface v1 — constants
//
// This integration surface is a read-only boundary PMFreak exposes to AOC
// Enterprise. PMFreak is the data provider; AOC Enterprise is the
// downstream consumer. This surface exposes PMFreak data and normalizes
// it into safe surface snapshots. It does not govern actions, resolve
// passports, run scenarios, build Control Plane views, build Narrative
// Exports, or accept writeback from AOC.

export const PMFREAK_AOC_READ_ONLY_SURFACE_ID = "pmfreak.integration.aoc.read_only_surface.v1" as const;

export const PMFREAK_AOC_READ_ONLY_SURFACE_NAME = "PMFreak AOC Read-Only Integration Surface v1" as const;

export const PMFREAK_AOC_PROVIDER_SYSTEM_ID = "pmfreak" as const;

export const PMFREAK_AOC_CONSUMER_SYSTEM_ID = "aoc" as const;

export const PMFREAK_AOC_READ_ONLY_SURFACE_CAPABILITIES = {
  readProjects: "read_projects",
  readAgents: "read_agents",
  readMilestones: "read_milestones",
  readTasks: "read_tasks",
  readRisks: "read_risks",
  readEvidenceReferences: "read_evidence_references",
  readApprovalReferences: "read_approval_references",
  readActionProposals: "read_action_proposals",
} as const;

export const PMFREAK_AOC_FORBIDDEN_SURFACE_OPERATIONS = [
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

export const PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS = [
  "read-only integration surface",
  "read-only PMFreak data",
  "No mutation performed",
  "No writeback performed",
  "Not production execution",
  "Not compliance certification",
  "No invoice validity claimed",
  "No customer acceptance certification",
] as const;

export const PMFREAK_AOC_READ_ONLY_SURFACE_DISCLAIMERS = [
  "This surface exposes PMFreak data to AOC Enterprise.",
  "This surface does not mutate PMFreak data.",
  "This surface does not execute actions.",
  "This surface does not create governance decisions.",
  "This surface does not send communications.",
  "This surface does not create invoices.",
  "This surface does not certify compliance.",
  "This surface does not provide legal advice.",
] as const;

// Lowercase, for substring matching in assertNoPMFreakAocReadOnlySurfaceOverclaim.
export const PMFREAK_AOC_READ_ONLY_SURFACE_PROHIBITED_OVERCLAIM_PHRASES = [
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
  "production surface certified",
  "write access enabled",
  "mutation allowed",
  "certified pmfreak connector",
  "certified pmfreak surface",
] as const;
