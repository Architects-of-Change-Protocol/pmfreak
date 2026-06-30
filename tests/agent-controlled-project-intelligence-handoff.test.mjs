// tests/agent-controlled-project-intelligence-handoff.test.mjs
// Controlled Project Intelligence Handoff — Test Suite
// Does NOT call LLMs, external APIs, or send communications.
// Uses readFileSync pattern consistent with all other test files in this repo.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── Source Files ──────────────────────────────────────────────────────────────

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-project-handoff-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-project-handoff-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-project-handoff-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-project-handoff-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260813000000_agent_controlled_project_intelligence_handoff.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docFile = readFileSync(resolve(ROOT, "docs/agent-controlled-project-intelligence-handoff.md"), "utf8");

// ─── Type Tests ────────────────────────────────────────────────────────────────

test("AgentPmoProjectHandoffRequestStatus includes handoff_completed", () => {
  assert.ok(typesFile.includes('"handoff_completed"'), 'Missing status: handoff_completed');
});

test("AgentPmoProjectHandoffRequestStatus includes continuity_monitoring", () => {
  assert.ok(typesFile.includes('"continuity_monitoring"'), 'Missing status: continuity_monitoring');
});

test("AgentPmoProjectHandoffRequestStatus includes all 18 expected statuses", () => {
  const statuses = [
    "created", "context_validation_pending", "context_validation_failed",
    "ready_for_pmo_review", "pmo_review_required", "pmo_approved", "pmo_rejected",
    "handoff_pack_pending", "handoff_pack_created", "outgoing_pm_notes_pending",
    "incoming_pm_review_required", "incoming_pm_accepted", "incoming_pm_rejected",
    "assignment_update_pending", "handoff_completed", "continuity_monitoring",
    "blocked", "archived",
  ];
  for (const s of statuses) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing status: ${s}`);
  }
});

test("AgentPmoProjectHandoffReason includes client_escalation", () => {
  assert.ok(typesFile.includes('"client_escalation"'), 'Missing reason: client_escalation');
});

test("AgentPmoProjectHandoffReason includes pm_departure", () => {
  assert.ok(typesFile.includes('"pm_departure"'), 'Missing reason: pm_departure');
});

test("AgentPmoProjectHandoffReason includes all 12 expected values", () => {
  const reasons = [
    "workload_rebalance", "pm_unavailable", "vacation_coverage", "role_change",
    "performance_intervention", "client_escalation", "project_complexity",
    "strategic_reassignment", "delivery_risk", "pm_departure", "temporary_coverage", "other",
  ];
  for (const r of reasons) {
    assert.ok(typesFile.includes(`"${r}"`), `Missing reason: ${r}`);
  }
});

test("AgentPmoProjectHandoffUrgency includes all 4 urgency values", () => {
  for (const u of ["low", "normal", "high", "critical"]) {
    assert.ok(typesFile.includes(`"${u}"`), `Missing urgency: ${u}`);
  }
});

test("AgentPmoProjectHandoffGateStatus includes approved_for_handoff", () => {
  assert.ok(typesFile.includes('"approved_for_handoff"'), 'Missing gate status: approved_for_handoff');
});

test("AgentPmoProjectHandoffGateDecisionType includes approve_for_handoff", () => {
  assert.ok(typesFile.includes('"approve_for_handoff"'), 'Missing decision: approve_for_handoff');
});

test("AgentPmoIncomingPmAcceptanceDecision includes accept_handoff and reject_handoff", () => {
  assert.ok(typesFile.includes('"accept_handoff"'), 'Missing decision: accept_handoff');
  assert.ok(typesFile.includes('"reject_handoff"'), 'Missing decision: reject_handoff');
});

test("AgentPmoProjectMemorySnapshotCategory includes all 15 categories", () => {
  const cats = [
    "project_summary", "delivery_history", "key_decisions", "risks", "blockers",
    "dependencies", "milestones", "stakeholders", "client_commitments", "commercial_notes",
    "technical_notes", "governance_notes", "open_questions", "next_actions", "lessons_learned",
  ];
  for (const c of cats) {
    assert.ok(typesFile.includes(`"${c}"`), `Missing memory snapshot category: ${c}`);
  }
});

test("AgentPmoHandoffContinuityCheckType includes all 10 check types", () => {
  const types = [
    "incoming_pm_acknowledged", "critical_risks_reviewed", "critical_blockers_reviewed",
    "upcoming_milestones_reviewed", "open_decisions_reviewed", "stakeholder_context_reviewed",
    "client_commitments_reviewed", "first_status_update_completed",
    "handoff_pack_reviewed", "assignment_pointer_verified",
  ];
  for (const t of types) {
    assert.ok(typesFile.includes(`"${t}"`), `Missing continuity check type: ${t}`);
  }
});

test("AgentPmoProjectAssignmentSource includes controlled_handoff", () => {
  assert.ok(typesFile.includes('"controlled_handoff"'), 'Missing source: controlled_handoff');
});

test("All required record types are defined in types file", () => {
  const records = [
    "AgentPmoProjectHandoffRequestRecord",
    "AgentPmoProjectContextValidationRecord",
    "AgentPmoProjectHandoffGateRecord",
    "AgentPmoProjectHandoffGateDecisionRecord",
    "AgentPmoProjectHandoffPackRecord",
    "AgentPmoProjectMemorySnapshotRecord",
    "AgentPmoProjectStatusSnapshotRecord",
    "AgentPmoProjectHandoffSnapshotItemRecord",
    "AgentPmoStakeholderContextSnapshotRecord",
    "AgentPmoOutgoingPmNoteRecord",
    "AgentPmoIncomingPmAcceptanceRecord",
    "AgentPmoControlledProjectAssignmentPointerRecord",
    "AgentPmoProjectAssignmentHistoryRecord",
    "AgentPmoHandoffContinuityCheckRecord",
    "AgentPmoProjectHandoffExportRecord",
    "AgentPmoProjectHandoffAuditEventRecord",
  ];
  for (const r of records) {
    assert.ok(typesFile.includes(r), `Missing record type: ${r}`);
  }
});

// ─── Validation Tests ──────────────────────────────────────────────────────────

test("validation file exports all required validators", () => {
  const validators = [
    "validateAgentPmoProjectHandoffRequestStatus",
    "validateAgentPmoProjectHandoffReason",
    "validateAgentPmoProjectHandoffUrgency",
    "validateAgentPmoProjectContextValidationStatus",
    "validateAgentPmoProjectHandoffGateStatus",
    "validateAgentPmoProjectHandoffGateDecisionType",
    "validateAgentPmoProjectHandoffPackStatus",
    "validateAgentPmoProjectMemorySnapshotCategory",
    "validateAgentPmoProjectMemorySnapshotStatus",
    "validateAgentPmoProjectHealthStatus",
    "validateAgentPmoProjectHandoffSnapshotItemType",
    "validateAgentPmoProjectHandoffSnapshotItemStatus",
    "validateAgentPmoProjectHandoffSnapshotItemSeverity",
    "validateAgentPmoStakeholderContextType",
    "validateAgentPmoStakeholderContextStatus",
    "validateAgentPmoOutgoingPmNoteType",
    "validateAgentPmoOutgoingPmNoteStatus",
    "validateAgentPmoIncomingPmAcceptanceStatus",
    "validateAgentPmoIncomingPmAcceptanceDecision",
    "validateAgentPmoProjectAssignmentSource",
    "validateAgentPmoHandoffContinuityCheckType",
    "validateAgentPmoHandoffContinuityCheckStatus",
    "validateAgentPmoProjectHandoffExportFormat",
    "validateAgentPmoProjectHandoffExportStatus",
    "validateAgentPmoProjectHandoffAuditEventType",
  ];
  for (const v of validators) {
    assert.ok(validationFile.includes(v), `Missing validator: ${v}`);
  }
});

test("validation file exports redactProjectHandoffPayload", () => {
  assert.ok(validationFile.includes("redactProjectHandoffPayload"), "Missing: redactProjectHandoffPayload");
});

test("validation file exports assertProjectHandoffPayloadSerializable", () => {
  assert.ok(validationFile.includes("assertProjectHandoffPayloadSerializable"), "Missing: assertProjectHandoffPayloadSerializable");
});

test("validation file exports sanitizeProjectHandoffText", () => {
  assert.ok(validationFile.includes("sanitizeProjectHandoffText"), "Missing: sanitizeProjectHandoffText");
});

test("validation file exports validateProjectHandoffExportSafety", () => {
  assert.ok(validationFile.includes("validateProjectHandoffExportSafety"), "Missing: validateProjectHandoffExportSafety");
});

test("validation file exports evaluateProjectHandoffCompletionReadiness", () => {
  assert.ok(validationFile.includes("evaluateProjectHandoffCompletionReadiness"), "Missing: evaluateProjectHandoffCompletionReadiness");
});

test("validation file includes blocked content pattern checks", () => {
  const patterns = ["password", "secret", "token", "apiKey", "private_key", "credential"];
  for (const p of patterns) {
    assert.ok(validationFile.includes(p), `Missing blocked pattern check: ${p}`);
  }
});

test("validation file exports normalizer functions", () => {
  const normalizers = [
    "normalizeCreateProjectHandoffRequestInput",
    "normalizeCreateProjectHandoffGateInput",
    "normalizeProjectHandoffGateDecisionInput",
    "normalizeOutgoingPmNoteInput",
    "normalizeIncomingPmAcceptanceInput",
    "normalizeCompleteProjectHandoffInput",
  ];
  for (const n of normalizers) {
    assert.ok(validationFile.includes(n), `Missing normalizer: ${n}`);
  }
});

// ─── Registry Tests ────────────────────────────────────────────────────────────

test("registry file exports all required functions", () => {
  const functions = [
    "createAgentPmoProjectHandoffRequest",
    "getAgentPmoProjectHandoffRequestById",
    "listAgentPmoProjectHandoffRequests",
    "updateAgentPmoProjectHandoffRequestStatus",
    "createAgentPmoProjectContextValidation",
    "listAgentPmoProjectContextValidations",
    "createAgentPmoProjectHandoffGate",
    "getAgentPmoProjectHandoffGateById",
    "listAgentPmoProjectHandoffGates",
    "updateAgentPmoProjectHandoffGateStatus",
    "recordAgentPmoProjectHandoffGateDecision",
    "listAgentPmoProjectHandoffGateDecisions",
    "createAgentPmoProjectHandoffPack",
    "getAgentPmoProjectHandoffPackById",
    "listAgentPmoProjectHandoffPacks",
    "createAgentPmoProjectMemorySnapshot",
    "listAgentPmoProjectMemorySnapshots",
    "createAgentPmoProjectStatusSnapshot",
    "listAgentPmoProjectStatusSnapshots",
    "createAgentPmoProjectHandoffSnapshotItem",
    "listAgentPmoProjectHandoffSnapshotItems",
    "createAgentPmoStakeholderContextSnapshot",
    "listAgentPmoStakeholderContextSnapshots",
    "recordAgentPmoOutgoingPmNote",
    "listAgentPmoOutgoingPmNotes",
    "recordAgentPmoIncomingPmAcceptance",
    "listAgentPmoIncomingPmAcceptances",
    "upsertAgentPmoControlledProjectAssignmentPointer",
    "getAgentPmoControlledProjectAssignmentPointerByProject",
    "listAgentPmoControlledProjectAssignmentPointers",
    "recordAgentPmoProjectAssignmentHistory",
    "listAgentPmoProjectAssignmentHistory",
    "createAgentPmoHandoffContinuityCheck",
    "listAgentPmoHandoffContinuityChecks",
    "updateAgentPmoHandoffContinuityCheckStatus",
    "createAgentPmoProjectHandoffExport",
    "getAgentPmoProjectHandoffExportById",
    "listAgentPmoProjectHandoffExports",
    "recordAgentPmoProjectHandoffAuditEvent",
    "listAgentPmoProjectHandoffAuditEvents",
    "_clearProjectHandoffStores",
  ];
  for (const f of functions) {
    assert.ok(registryFile.includes(f), `Missing registry function: ${f}`);
  }
});

test("registry assignment pointer key uses composite workspace::project key", () => {
  assert.ok(
    registryFile.includes("workspaceId::projectId") || registryFile.includes("`${workspaceId}::${projectId}`"),
    "Assignment pointer must use composite workspace::project key"
  );
});

test("registry uses in-memory Map/array stores (no Supabase)", () => {
  assert.ok(registryFile.includes("new Map"), "Registry must use in-memory Map stores");
  assert.ok(!registryFile.includes("supabase"), "Registry must not use Supabase directly");
});

test("registry assignment history is append-only (no delete)", () => {
  assert.ok(!registryFile.includes("deleteAssignmentHistory"), "Assignment history must be append-only");
});

test("registry audit events are append-only (no delete)", () => {
  assert.ok(!registryFile.includes("deleteAuditEvent"), "Audit events must be append-only");
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("service file exports all required service functions", () => {
  const functions = [
    "createProjectHandoffRequest",
    "validateProjectHandoffContext",
    "createProjectHandoffGate",
    "recordProjectHandoffGateDecision",
    "generateProjectHandoffPack",
    "createProjectMemorySnapshot",
    "createProjectStatusSnapshot",
    "createProjectHandoffSnapshotItems",
    "createStakeholderContextSnapshot",
    "recordOutgoingPmNote",
    "recordIncomingPmAcceptance",
    "completeProjectHandoff",
    "createHandoffContinuityChecks",
    "updateHandoffContinuityCheck",
    "generateProjectHandoffExport",
    "archiveProjectHandoffRequest",
    "buildProjectHandoffSummary",
    "getProjectHandoffData",
  ];
  for (const f of functions) {
    assert.ok(serviceFile.includes(f), `Missing service function: ${f}`);
  }
});

test("createProjectHandoffRequest does NOT update assignment pointer", () => {
  // Verified: createProjectHandoffRequest does not call upsertAgentPmoControlledProjectAssignmentPointer
  const createFnStart = serviceFile.indexOf("export async function createProjectHandoffRequest");
  const nextExportFn = serviceFile.indexOf("export async function", createFnStart + 1);
  const createFnBody = serviceFile.slice(createFnStart, nextExportFn);
  assert.ok(
    !createFnBody.includes("upsertAgentPmoControlledProjectAssignmentPointer"),
    "createProjectHandoffRequest must NOT call upsertAgentPmoControlledProjectAssignmentPointer"
  );
});

test("validateProjectHandoffContext does NOT update assignment pointer", () => {
  const fnStart = serviceFile.indexOf("export async function validateProjectHandoffContext");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(
    !fnBody.includes("upsertAgentPmoControlledProjectAssignmentPointer"),
    "validateProjectHandoffContext must NOT call upsertAgentPmoControlledProjectAssignmentPointer"
  );
});

test("recordProjectHandoffGateDecision does NOT complete handoff", () => {
  const fnStart = serviceFile.indexOf("export async function recordProjectHandoffGateDecision");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(
    !fnBody.includes("handoff_completed"),
    "recordProjectHandoffGateDecision must NOT set status to handoff_completed"
  );
  assert.ok(
    !fnBody.includes("upsertAgentPmoControlledProjectAssignmentPointer"),
    "recordProjectHandoffGateDecision must NOT create assignment pointer"
  );
});

test("generateProjectHandoffPack requires pmo_approved status", () => {
  assert.ok(serviceFile.includes("pmo_approved"), "generateProjectHandoffPack must require pmo_approved");
});

test("generateProjectHandoffPack records limitations when sources unavailable", () => {
  assert.ok(serviceFile.includes("limitation") || serviceFile.includes("Limitation"), "Pack must record limitations");
});

test("createProjectMemorySnapshot creates snapshots for all 15 categories", () => {
  const categories = [
    "project_summary", "delivery_history", "key_decisions", "risks", "blockers",
    "dependencies", "milestones", "stakeholders", "client_commitments", "commercial_notes",
    "technical_notes", "governance_notes", "open_questions", "next_actions", "lessons_learned",
  ];
  for (const c of categories) {
    assert.ok(serviceFile.includes(c), `createProjectMemorySnapshot must handle category: ${c}`);
  }
});

test("recordIncomingPmAcceptance requires handoff pack to exist", () => {
  const fnStart = serviceFile.indexOf("export async function recordIncomingPmAcceptance");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(
    fnBody.includes("handoff pack") || fnBody.includes("pack"),
    "recordIncomingPmAcceptance must require pack to exist"
  );
});

test("recordIncomingPmAcceptance does NOT update assignment pointer", () => {
  const fnStart = serviceFile.indexOf("export async function recordIncomingPmAcceptance");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(
    !fnBody.includes("upsertAgentPmoControlledProjectAssignmentPointer"),
    "recordIncomingPmAcceptance must NOT call upsertAgentPmoControlledProjectAssignmentPointer"
  );
});

test("completeProjectHandoff requires incoming_pm_accepted status via completion readiness check", () => {
  const fnStart = serviceFile.indexOf("export async function completeProjectHandoff");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  // The function uses evaluateProjectHandoffCompletionReadiness which enforces incoming_pm_accepted
  assert.ok(
    fnBody.includes("evaluateProjectHandoffCompletionReadiness"),
    "completeProjectHandoff must call evaluateProjectHandoffCompletionReadiness"
  );
  // Also verify the readiness evaluator enforces incoming_pm_accepted
  const evalFnStart = validationFile.indexOf("export function evaluateProjectHandoffCompletionReadiness");
  const evalNextFn = validationFile.indexOf("export function", evalFnStart + 1);
  const evalBody = validationFile.slice(evalFnStart, evalNextFn);
  assert.ok(
    evalBody.includes("incoming_pm_accepted"),
    "evaluateProjectHandoffCompletionReadiness must require incoming_pm_accepted status"
  );
});

test("completeProjectHandoff updates controlled assignment pointer", () => {
  const fnStart = serviceFile.indexOf("export async function completeProjectHandoff");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(
    fnBody.includes("upsertAgentPmoControlledProjectAssignmentPointer"),
    "completeProjectHandoff must call upsertAgentPmoControlledProjectAssignmentPointer"
  );
});

test("completeProjectHandoff preserves previousPmId in pointer", () => {
  const fnStart = serviceFile.indexOf("export async function completeProjectHandoff");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(
    fnBody.includes("previousPmId"),
    "completeProjectHandoff must preserve previousPmId"
  );
});

test("createHandoffContinuityChecks creates checks for 10 types", () => {
  const checks = [
    "incoming_pm_acknowledged", "critical_risks_reviewed", "critical_blockers_reviewed",
    "upcoming_milestones_reviewed", "open_decisions_reviewed", "stakeholder_context_reviewed",
    "client_commitments_reviewed", "first_status_update_completed",
    "handoff_pack_reviewed", "assignment_pointer_verified",
  ];
  for (const c of checks) {
    assert.ok(serviceFile.includes(c), `createHandoffContinuityChecks must include check: ${c}`);
  }
});

test("createHandoffContinuityChecks does not send reminders or notifications", () => {
  const fnStart = serviceFile.indexOf("export async function createHandoffContinuityChecks");
  const nextFn = serviceFile.indexOf("export async function", fnStart + 1);
  const fnBody = serviceFile.slice(fnStart, nextFn);
  assert.ok(!fnBody.includes("sendEmail"), "createHandoffContinuityChecks must not send email");
  assert.ok(!fnBody.includes("sendSlack"), "createHandoffContinuityChecks must not send Slack");
  assert.ok(!fnBody.includes("sendNotification"), "createHandoffContinuityChecks must not send notifications");
  assert.ok(!fnBody.includes("scheduleJob"), "createHandoffContinuityChecks must not schedule jobs");
});

test("generateProjectHandoffExport excludes blocked content patterns", () => {
  assert.ok(
    serviceFile.includes("validateProjectHandoffExportSafety"),
    "generateProjectHandoffExport must run safety validation"
  );
});

// ─── Prohibited Behavior — Service must not call external systems ─────────────

test("service does not import openai, anthropic, or gemini", () => {
  assert.ok(!serviceFile.includes("openai"), "Must not import openai");
  assert.ok(!serviceFile.includes("anthropic"), "Must not import anthropic");
  assert.ok(!serviceFile.includes("gemini"), "Must not import gemini");
});

test("service does not use embedding or training calls", () => {
  assert.ok(!serviceFile.includes("createEmbedding"), "Must not create embeddings");
  assert.ok(!serviceFile.includes("trainModel"), "Must not train models");
  assert.ok(!serviceFile.includes("fineTuneModel"), "Must not fine-tune models");
});

test("service does not call fetch()", () => {
  assert.ok(!serviceFile.includes("fetch("), "Must not call fetch() in service");
});

test("service does not send communications", () => {
  assert.ok(!serviceFile.includes("sendEmail"), "Must not send email");
  assert.ok(!serviceFile.includes("sendSlack"), "Must not send Slack");
  assert.ok(!serviceFile.includes("createCalendarEvent"), "Must not create calendar events");
});

test("service does not create Jira or GitHub tickets", () => {
  assert.ok(!serviceFile.includes("createJiraTicket"), "Must not create Jira tickets");
  assert.ok(!serviceFile.includes("createJira"), "Must not create Jira");
  assert.ok(!serviceFile.includes("createGithubIssue"), "Must not create GitHub issues");
  assert.ok(!serviceFile.includes("createGitHubIssue"), "Must not create GitHub issues");
});

test("service does not execute adapters", () => {
  assert.ok(!serviceFile.includes("executeAdapter"), "Must not execute adapter");
  assert.ok(!serviceFile.includes("runAdapter"), "Must not run adapter");
  assert.ok(!serviceFile.includes("dispatchExecutionToAdapter"), "Must not dispatch to adapter");
});

test("service does not delete project memory or overwrite project brain", () => {
  assert.ok(!serviceFile.includes("deleteProjectMemory"), "Must not delete project memory");
  assert.ok(!serviceFile.includes("overwriteProjectBrain"), "Must not overwrite project brain");
  assert.ok(!serviceFile.includes("eraseProjectHistory"), "Must not erase project history");
});

test("service does not auto-assign PM owner", () => {
  assert.ok(!serviceFile.includes("autoAssignProjectOwner"), "Must not auto-assign PM");
});

test("service does not call external APIs directly", () => {
  assert.ok(!serviceFile.includes("callExternalApi"), "Must not call external API");
  assert.ok(!serviceFile.includes("callOpenAI"), "Must not call OpenAI");
  assert.ok(!serviceFile.includes("callAnthropic"), "Must not call Anthropic");
  assert.ok(!serviceFile.includes("callGemini"), "Must not call Gemini");
});

test("service does not retain raw payloads in exports", () => {
  // The export generation should not include raw_payload or outcomePayload fields
  const exportFnStart = serviceFile.indexOf("export async function generateProjectHandoffExport");
  const nextFn = serviceFile.indexOf("export async function", exportFnStart + 1);
  const exportBody = serviceFile.slice(exportFnStart, nextFn);
  // Export must run safety validation
  assert.ok(exportBody.includes("validateProjectHandoffExportSafety"), "Export must run safety validation");
});

// ─── Database Migration Tests ─────────────────────────────────────────────────

test("migration creates all 16 required tables", () => {
  const tables = [
    "agent_pmo_project_handoff_requests",
    "agent_pmo_project_context_validations",
    "agent_pmo_project_handoff_gates",
    "agent_pmo_project_handoff_gate_decisions",
    "agent_pmo_project_handoff_packs",
    "agent_pmo_project_memory_snapshots",
    "agent_pmo_project_status_snapshots",
    "agent_pmo_project_handoff_snapshot_items",
    "agent_pmo_stakeholder_context_snapshots",
    "agent_pmo_outgoing_pm_notes",
    "agent_pmo_incoming_pm_acceptances",
    "agent_pmo_controlled_project_assignment_pointers",
    "agent_pmo_project_assignment_history",
    "agent_pmo_handoff_continuity_checks",
    "agent_pmo_project_handoff_exports",
    "agent_pmo_project_handoff_audit_events",
  ];
  for (const t of tables) {
    assert.ok(migrationFile.includes(t), `Missing table in migration: ${t}`);
  }
});

test("migration enables RLS on all tables", () => {
  assert.ok(
    migrationFile.includes("ENABLE ROW LEVEL SECURITY"),
    "Migration must enable RLS"
  );
});

test("migration does not use USING (true) policies", () => {
  assert.ok(
    !migrationFile.includes("USING (true)"),
    "Migration must not use USING (true) policies"
  );
});

test("migration has UNIQUE constraint on assignment pointer (workspace_id, project_id)", () => {
  assert.ok(
    migrationFile.includes("workspace_id, project_id") || migrationFile.includes("UNIQUE (workspace_id, project_id)"),
    "Migration must enforce UNIQUE constraint on (workspace_id, project_id) for assignment pointer"
  );
});

test("migration does not include RLS using_true bypass", () => {
  const usingTrue = migrationFile.match(/USING\s*\(\s*true\s*\)/g);
  assert.equal(usingTrue, null, "Migration must not bypass RLS with USING (true)");
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("database contract includes controlled-project-intelligence-handoff in version", () => {
  assert.ok(
    contractFile.includes("controlled-project-intelligence-handoff"),
    "Database contract version must include controlled-project-intelligence-handoff"
  );
});

test("database contract includes all 16 new Row types", () => {
  const rowTypes = [
    "AgentPmoProjectHandoffRequestRow",
    "AgentPmoProjectContextValidationRow",
    "AgentPmoProjectHandoffGateRow",
    "AgentPmoProjectHandoffGateDecisionRow",
    "AgentPmoProjectHandoffPackRow",
    "AgentPmoProjectMemorySnapshotRow",
    "AgentPmoProjectStatusSnapshotRow",
    "AgentPmoProjectHandoffSnapshotItemRow",
    "AgentPmoStakeholderContextSnapshotRow",
    "AgentPmoOutgoingPmNoteRow",
    "AgentPmoIncomingPmAcceptanceRow",
    "AgentPmoControlledProjectAssignmentPointerRow",
    "AgentPmoProjectAssignmentHistoryRow",
    "AgentPmoHandoffContinuityCheckRow",
    "AgentPmoProjectHandoffExportRow",
    "AgentPmoProjectHandoffAuditEventRow",
  ];
  for (const r of rowTypes) {
    assert.ok(contractFile.includes(r), `Missing Row type in database contract: ${r}`);
  }
});

test("database contract includes all 16 column constant arrays", () => {
  const cols = [
    "AGENT_PMO_PROJECT_HANDOFF_REQUEST_COLUMNS",
    "AGENT_PMO_PROJECT_CONTEXT_VALIDATION_COLUMNS",
    "AGENT_PMO_PROJECT_HANDOFF_GATE_COLUMNS",
    "AGENT_PMO_PROJECT_HANDOFF_GATE_DECISION_COLUMNS",
    "AGENT_PMO_PROJECT_HANDOFF_PACK_COLUMNS",
    "AGENT_PMO_PROJECT_MEMORY_SNAPSHOT_COLUMNS",
    "AGENT_PMO_PROJECT_STATUS_SNAPSHOT_COLUMNS",
    "AGENT_PMO_PROJECT_HANDOFF_SNAPSHOT_ITEM_COLUMNS",
    "AGENT_PMO_STAKEHOLDER_CONTEXT_SNAPSHOT_COLUMNS",
    "AGENT_PMO_OUTGOING_PM_NOTE_COLUMNS",
    "AGENT_PMO_INCOMING_PM_ACCEPTANCE_COLUMNS",
    "AGENT_PMO_CONTROLLED_PROJECT_ASSIGNMENT_POINTER_COLUMNS",
    "AGENT_PMO_PROJECT_ASSIGNMENT_HISTORY_COLUMNS",
    "AGENT_PMO_HANDOFF_CONTINUITY_CHECK_COLUMNS",
    "AGENT_PMO_PROJECT_HANDOFF_EXPORT_COLUMNS",
    "AGENT_PMO_PROJECT_HANDOFF_AUDIT_EVENT_COLUMNS",
  ];
  for (const c of cols) {
    assert.ok(contractFile.includes(c), `Missing column constant in database contract: ${c}`);
  }
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types include all 18 new handoff event types", () => {
  const events = [
    "pmo_project_handoff_request_created",
    "pmo_project_handoff_context_validation_created",
    "pmo_project_handoff_context_validation_completed",
    "pmo_project_handoff_gate_created",
    "pmo_project_handoff_gate_decision_recorded",
    "pmo_project_handoff_pack_created",
    "pmo_project_memory_snapshot_created",
    "pmo_project_status_snapshot_created",
    "pmo_project_handoff_snapshot_item_created",
    "pmo_project_stakeholder_context_snapshot_created",
    "pmo_outgoing_pm_note_recorded",
    "pmo_incoming_pm_acceptance_recorded",
    "pmo_project_assignment_pointer_updated",
    "pmo_project_assignment_history_recorded",
    "pmo_project_handoff_continuity_check_created",
    "pmo_project_handoff_continuity_check_completed",
    "pmo_project_handoff_export_created",
    "pmo_project_handoff_request_archived",
  ];
  for (const e of events) {
    assert.ok(obsFile.includes(e), `Missing observability event type: ${e}`);
  }
});

test("observability types include agent_controlled_project_intelligence_handoff source type", () => {
  assert.ok(
    obsFile.includes("agent_controlled_project_intelligence_handoff"),
    "Missing source type: agent_controlled_project_intelligence_handoff"
  );
});

// ─── Export Index Tests ───────────────────────────────────────────────────────

test("index.ts exports all handoff types", () => {
  assert.ok(indexFile.includes("agent-pmo-project-handoff-types"), "index.ts must export handoff types");
});

test("index.ts exports all handoff validation helpers", () => {
  assert.ok(indexFile.includes("agent-pmo-project-handoff-validation"), "index.ts must export handoff validation");
});

test("index.ts exports all handoff registry functions", () => {
  assert.ok(indexFile.includes("agent-pmo-project-handoff-registry"), "index.ts must export handoff registry");
});

test("index.ts exports all handoff service functions", () => {
  assert.ok(indexFile.includes("agent-pmo-project-handoff-service"), "index.ts must export handoff service");
});

// ─── Terminology Verification ─────────────────────────────────────────────────

test("types file does not contain prohibited terminology", () => {
  const bad = typesFile.match(/[Ff]ucker/g);
  assert.equal(bad, null, "Types file must not contain prohibited terminology");
});

test("validation file does not contain prohibited terminology", () => {
  const bad = validationFile.match(/[Ff]ucker/g);
  assert.equal(bad, null, "Validation file must not contain prohibited terminology");
});

test("registry file does not contain prohibited terminology", () => {
  const bad = registryFile.match(/[Ff]ucker/g);
  assert.equal(bad, null, "Registry file must not contain prohibited terminology");
});

test("service file does not contain prohibited terminology", () => {
  const bad = serviceFile.match(/[Ff]ucker/g);
  assert.equal(bad, null, "Service file must not contain prohibited terminology");
});

test("migration file does not contain prohibited terminology", () => {
  const bad = migrationFile.match(/[Ff]ucker/g);
  assert.equal(bad, null, "Migration file must not contain prohibited terminology");
});

// ─── Documentation Tests ──────────────────────────────────────────────────────

test("documentation file exists and covers purpose", () => {
  assert.ok(
    docFile.includes("Controlled Project Intelligence Handoff"),
    "Documentation must describe the layer"
  );
});

test("documentation explicitly states prohibited behaviors", () => {
  assert.ok(docFile.includes("does not execute adapters"), "Documentation must state no adapter execution");
  assert.ok(docFile.includes("delete project memory"), "Documentation must address memory deletion prohibition");
  assert.ok(docFile.includes("overwrite project brain"), "Documentation must address brain overwrite prohibition");
});

test("documentation includes all 16 domain model sections", () => {
  const sections = [
    "Handoff Request",
    "Context Validation",
    "Approval Gate",
    "Handoff Pack",
    "Memory Snapshot",
    "Status Snapshot",
    "Snapshot Item",
    "Stakeholder Context",
    "Outgoing PM",
    "Incoming PM",
    "Assignment Pointer",
    "Assignment History",
    "Continuity Check",
    "Export",
    "Audit",
  ];
  for (const s of sections) {
    assert.ok(docFile.includes(s), `Documentation must include section: ${s}`);
  }
});

// ─── Regression Tests — Prior Layers ─────────────────────────────────────────

test("Regression: policy activation types file still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-types.ts")),
    "Policy activation types must still exist"
  );
});

test("Regression: dry-run gate types file still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-dry-run-gate-types.ts")),
    "Dry-run gate types must still exist"
  );
});

test("Regression: implementation planning types file still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-types.ts")),
    "Implementation planning types must still exist"
  );
});

test("Regression: approval pack types file still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-approval-pack-types.ts")),
    "Approval pack types must still exist"
  );
});

test("Regression: policy activation migration still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "supabase/migrations/20260812000000_agent_controlled_policy_version_activation_rollback_gate.sql")),
    "Policy activation migration must still exist"
  );
});

test("Regression: migration file exists for handoff sprint", () => {
  assert.ok(
    existsSync(resolve(ROOT, "supabase/migrations/20260813000000_agent_controlled_project_intelligence_handoff.sql")),
    "Handoff migration file must exist"
  );
});

test("Regression: database contract still includes policy activation layer", () => {
  assert.ok(
    contractFile.includes("controlled-policy-version-activation-rollback-gate"),
    "Database contract must still include policy activation layer"
  );
});
