export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID = "pmfreak.integration.aoc.evidence_requirement_handoff.v1" as const;

export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_NAME = "PMFreak Evidence Requirement Handoff v1" as const;

export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_VERSION = "v1" as const;

export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CAPABILITIES = {
  extractEvidenceRequirements: "extract_evidence_requirements",
  createHandoffPackage: "create_handoff_package",
  createChecklistViewModel: "create_checklist_view_model",
  createReviewPacket: "create_review_packet",
  summarizeHandoffs: "summarize_handoffs",
  batchCreateHandoffs: "batch_create_handoffs",
  renderSafeHandoffModel: "render_safe_handoff_model",
} as const;

export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS = [
  "attach_evidence",
  "upload_evidence",
  "create_evidence",
  "create_evidence_task",
  "create_task",
  "update_task",
  "delete_task",
  "create_approval_task",
  "approve_evidence",
  "validate_evidence",
  "certify_evidence",
  "certify_customer_acceptance",
  "certify_invoice_validity",
  "execute_action",
  "run_action",
  "apply_decision",
  "auto_apply_decision",
  "mutate_project",
  "update_project",
  "delete_project",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "update_schedule",
  "close_risk",
  "approve_action",
  "send_client_communication",
  "send_email",
  "post_to_slack",
  "notify_customer",
  "request_customer_evidence",
  "create_invoice",
  "writeback_decision",
  "enforce_with_mutation",
  "certify_compliance",
] as const;

// Subset of PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS
// that the no-attachment guard rejects.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ATTACHMENT_FORBIDDEN_OPERATIONS = [
  "attach_evidence",
  "upload_evidence",
  "create_evidence",
  "validate_evidence",
  "certify_evidence",
  "approve_evidence",
] as const;

// Subset of PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS
// that the no-task guard rejects.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_TASK_FORBIDDEN_OPERATIONS = [
  "create_task",
  "update_task",
  "delete_task",
  "create_evidence_task",
  "create_approval_task",
] as const;

// Subset of PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS
// that the no-mutation guard rejects.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_MUTATION_FORBIDDEN_OPERATIONS = [
  "mutate_project",
  "update_project",
  "delete_project",
  "mark_milestone_complete",
  "mark_milestone_billing_ready",
  "update_schedule",
  "close_risk",
  "writeback_decision",
] as const;

// Subset of PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_FORBIDDEN_OPERATIONS
// that the no-communication guard rejects.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_COMMUNICATION_FORBIDDEN_OPERATIONS = [
  "send_client_communication",
  "send_email",
  "post_to_slack",
  "notify_customer",
  "request_customer_evidence",
] as const;

// A superset of these (plus a few decision/verdict vocabulary phrases)
// doubles as the false-positive corpus for claim-safety checks in
// pmfreak-aoc-evidence-requirement-handoff-claim-safety.ts.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS = [
  "PMFreak consumes AOC Governance",
  "Evidence requirement handoff",
  "Handoff only",
  "No evidence attachment performed",
  "No task creation performed",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No decision writeback performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
] as const;

export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_DISCLAIMERS = [
  "This feature creates handoff packages for AOC evidence requirements.",
  "This feature consumes AOC governance responses, decision inbox items, governed action gate results and gate result UI display models.",
  "This feature identifies required and missing evidence references.",
  "This feature creates display-safe evidence requirement packages, checklists and review packets.",
  "This feature does not attach evidence.",
  "This feature does not upload files.",
  "This feature does not create tasks.",
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
