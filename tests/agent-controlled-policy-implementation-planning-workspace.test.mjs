// ─── PMO Controlled Policy Implementation Planning Workspace — Tests
// No LLM calls. No external API calls. No real side effects.
// Planning workspace records are NOT authorizations to implement policies.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-implementation-planning-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260810000000_agent_controlled_policy_implementation_planning_workspace.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-policy-implementation-planning-workspace.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-policy-implementation-planning-workspace.md"), "utf8")
  : "";

const {
  validateAgentPmoImplementationPlanningWorkspaceStatus,
  validateAgentPmoImplementationPlanDraftStatus,
  validateAgentPmoImplementationTaskType,
  validateAgentPmoImplementationTaskStatus,
  validateAgentPmoPreImplementationChecklistStatus,
  validateAgentPmoStakeholderRole,
  validateAgentPmoStakeholderReadinessStatus,
  validateAgentPmoChangeWindowType,
  validateAgentPmoChangeWindowStatus,
  validateAgentPmoImplementationRiskType,
  validateAgentPmoImplementationRiskStatus,
  validateAgentPmoImplementationRiskSeverity,
  validateAgentPmoRollbackRehearsalType,
  validateAgentPmoRollbackRehearsalStatus,
  validateAgentPmoImplementationGatePrerequisiteType,
  validateAgentPmoImplementationGatePrerequisiteStatus,
  validateAgentPmoImplementationPlanningDecisionType,
  validateAgentPmoImplementationPlanningExportFormat,
  validateAgentPmoImplementationPlanningExportStatus,
  validateAgentPmoImplementationPlanningEventType,
  assertImplementationPlanningPayloadSerializable,
  redactImplementationPlanningPayload,
  sanitizeImplementationPlanningText,
  dedupeImplementationPlanningStrings,
  normalizeCreateImplementationPlanningWorkspaceInput,
  normalizeCreateImplementationPlanDraftInput,
  normalizePlanningDecisionInput,
  normalizeImplementationPlanningExportInput,
  evaluatePreImplementationChecklistStatus,
  evaluateStakeholderReadinessSummary,
  evaluateGatePrerequisiteReadiness,
  deriveImplementationPlanningWorkspaceStatus,
  validateImplementationPlanningExportSafety,
} = await import("../src/lib/agents/agent-pmo-implementation-planning-validation.ts");

const {
  _clearImplementationPlanningStores,
  createAgentPmoImplementationPlanningWorkspace,
  getAgentPmoImplementationPlanningWorkspaceById,
  listAgentPmoImplementationPlanningWorkspaces,
  updateAgentPmoImplementationPlanningWorkspaceStatus,
  createAgentPmoImplementationPlanDraft,
  getAgentPmoImplementationPlanDraftById,
  listAgentPmoImplementationPlanDrafts,
  updateAgentPmoImplementationPlanDraftStatus,
  createAgentPmoImplementationTaskBreakdown,
  listAgentPmoImplementationTaskBreakdowns,
  updateAgentPmoImplementationTaskStatus,
  createAgentPmoPreImplementationChecklist,
  createAgentPmoPreImplementationChecklistItem,
  listAgentPmoPreImplementationChecklistItems,
  createAgentPmoStakeholderReadiness,
  listAgentPmoStakeholderReadiness,
  updateAgentPmoStakeholderReadinessStatus,
  createAgentPmoChangeWindowPlan,
  listAgentPmoChangeWindowPlans,
  updateAgentPmoChangeWindowStatus,
  createAgentPmoImplementationRisk,
  listAgentPmoImplementationRisks,
  updateAgentPmoImplementationRiskStatus,
  createAgentPmoRollbackRehearsalPlan,
  listAgentPmoRollbackRehearsalPlans,
  updateAgentPmoRollbackRehearsalStatus,
  createAgentPmoImplementationGatePrerequisite,
  listAgentPmoImplementationGatePrerequisites,
  updateAgentPmoImplementationGatePrerequisiteStatus,
  recordAgentPmoImplementationPlanningDecision,
  listAgentPmoImplementationPlanningDecisions,
  createAgentPmoImplementationPlanningExport,
  getAgentPmoImplementationPlanningExportById,
  listAgentPmoImplementationPlanningExports,
  recordAgentPmoImplementationPlanningEvent,
  listAgentPmoImplementationPlanningEvents,
} = await import("../src/lib/agents/agent-pmo-implementation-planning-registry.ts");

const {
  createImplementationPlanningWorkspaceFromApprovalPack,
  createImplementationPlanDraft,
  generateImplementationTaskBreakdown,
  generatePreImplementationChecklist,
  recordStakeholderReadiness,
  proposeChangeWindowPlan,
  registerImplementationRisk,
  createRollbackRehearsalPlan,
  evaluateImplementationGatePrerequisites,
  recordImplementationPlanningDecision,
  generateImplementationPlanningExport,
  archiveImplementationPlanningWorkspace,
  buildImplementationPlanningSummary,
  getImplementationPlanningData,
} = await import("../src/lib/agents/agent-pmo-implementation-planning-service.ts");

// ─── Type/Status Tests ────────────────────────────────────────────────────────

test("workspace statuses contain expected values", () => {
  for (const s of ["created","planning","under_review","changes_requested","approved_for_dry_run_planning","blocked","archived"]) {
    assert.ok(validateAgentPmoImplementationPlanningWorkspaceStatus(s), `missing: ${s}`);
  }
  assert.ok(!validateAgentPmoImplementationPlanningWorkspaceStatus("invalid"));
});

test("plan draft statuses contain approved_for_dry_run_planning", () => {
  assert.ok(validateAgentPmoImplementationPlanDraftStatus("approved_for_dry_run_planning"));
  assert.ok(validateAgentPmoImplementationPlanDraftStatus("created"));
  assert.ok(!validateAgentPmoImplementationPlanDraftStatus("unknown"));
});

test("task types include dry_run_preparation", () => {
  assert.ok(validateAgentPmoImplementationTaskType("dry_run_preparation"));
  assert.ok(validateAgentPmoImplementationTaskType("policy_version_preparation"));
  assert.ok(!validateAgentPmoImplementationTaskType("unknown_task"));
});

test("task statuses valid", () => {
  for (const s of ["planned","ready_for_planning_review","blocked","deferred","removed"]) {
    assert.ok(validateAgentPmoImplementationTaskStatus(s), `missing: ${s}`);
  }
});

test("checklist statuses valid", () => {
  for (const s of ["not_started","pending","passed","failed","blocked","not_applicable"]) {
    assert.ok(validateAgentPmoPreImplementationChecklistStatus(s), `missing: ${s}`);
  }
});

test("stakeholder roles valid", () => {
  for (const r of ["pmo_owner","security_owner","operations_owner","data_governance_owner","executive_sponsor","implementation_owner","rollback_owner"]) {
    assert.ok(validateAgentPmoStakeholderRole(r), `missing: ${r}`);
  }
});

test("change window types valid", () => {
  for (const t of ["standard","maintenance","emergency_planning","low_traffic","business_hours","after_hours"]) {
    assert.ok(validateAgentPmoChangeWindowType(t), `missing: ${t}`);
  }
});

test("risk types valid", () => {
  for (const t of ["policy_behavior_risk","routing_risk","scoring_risk","evidence_requirement_risk","adapter_governance_risk","operational_risk","rollback_risk","stakeholder_risk","data_safety_risk","compliance_risk"]) {
    assert.ok(validateAgentPmoImplementationRiskType(t), `missing: ${t}`);
  }
});

test("risk severities valid", () => {
  for (const s of ["low","medium","high","critical"]) {
    assert.ok(validateAgentPmoImplementationRiskSeverity(s), `missing: ${s}`);
  }
});

test("rehearsal types valid", () => {
  for (const t of ["tabletop","configuration_review","version_revert_review","routing_restore_review","scoring_restore_review","evidence_requirement_restore_review","adapter_governance_review"]) {
    assert.ok(validateAgentPmoRollbackRehearsalType(t), `missing: ${t}`);
  }
});

test("gate prerequisite types valid", () => {
  for (const t of ["approval_pack_exists","approval_pack_signed_off","implementation_plan_approved","task_breakdown_reviewed","stakeholders_acknowledged","change_window_reviewed","risk_register_reviewed","rollback_rehearsal_ready","validation_checklist_passed","security_review_complete","operations_review_complete","data_governance_review_complete"]) {
    assert.ok(validateAgentPmoImplementationGatePrerequisiteType(t), `missing: ${t}`);
  }
});

test("decision types valid", () => {
  for (const d of ["approve_plan_for_dry_run_planning","request_changes","block_plan","waive_prerequisite","archive_planning_workspace"]) {
    assert.ok(validateAgentPmoImplementationPlanningDecisionType(d), `missing: ${d}`);
  }
});

test("export formats valid", () => {
  for (const f of ["markdown","json","csv"]) {
    assert.ok(validateAgentPmoImplementationPlanningExportFormat(f), `missing: ${f}`);
  }
});

test("event types valid", () => {
  for (const e of [
    "implementation_planning_workspace_created","implementation_plan_draft_created",
    "implementation_task_breakdown_created","implementation_planning_checklist_created",
    "implementation_planning_checklist_item_recorded","stakeholder_readiness_recorded",
    "change_window_plan_created","implementation_risk_registered",
    "rollback_rehearsal_plan_created","implementation_gate_prerequisite_recorded",
    "implementation_planning_decision_recorded","implementation_planning_export_created",
    "implementation_planning_workspace_archived",
  ]) {
    assert.ok(validateAgentPmoImplementationPlanningEventType(e), `missing: ${e}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("assertImplementationPlanningPayloadSerializable throws on non-serializable", () => {
  assert.throws(() => assertImplementationPlanningPayloadSerializable(undefined));
});

test("assertImplementationPlanningPayloadSerializable passes for valid object", () => {
  assert.doesNotThrow(() => assertImplementationPlanningPayloadSerializable({ foo: "bar" }));
});

test("redactImplementationPlanningPayload removes blocked keys", () => {
  const result = redactImplementationPlanningPayload({ foo: "bar", password: "secret", email: "test@test.com", token: "abc" });
  assert.ok(!("password" in result));
  assert.ok(!("email" in result));
  assert.ok(!("token" in result));
  assert.equal(result.foo, "bar");
});

test("sanitizeImplementationPlanningText trims and truncates", () => {
  const long = "a".repeat(5000);
  const result = sanitizeImplementationPlanningText(long);
  assert.ok(result.length <= 4000);
});

test("dedupeImplementationPlanningStrings deduplicates", () => {
  const result = dedupeImplementationPlanningStrings(["a","b","a","c","b"]);
  assert.deepEqual(result, ["a","b","c"]);
});

test("evaluatePreImplementationChecklistStatus returns passed when all passed", () => {
  const items = [{ status: "passed" }, { status: "passed" }, { status: "not_applicable" }];
  assert.equal(evaluatePreImplementationChecklistStatus(items), "passed");
});

test("evaluatePreImplementationChecklistStatus returns blocked when any blocked", () => {
  const items = [{ status: "passed" }, { status: "blocked" }];
  assert.equal(evaluatePreImplementationChecklistStatus(items), "blocked");
});

test("evaluateStakeholderReadinessSummary returns correct counts", () => {
  const records = [
    { status: "acknowledged" },
    { status: "pending" },
    { status: "blocked" },
    { status: "waived" },
  ];
  const summary = evaluateStakeholderReadinessSummary(records);
  assert.equal(summary.acknowledged, 2);
  assert.equal(summary.pending, 1);
  assert.equal(summary.blocked, 1);
});

test("evaluateGatePrerequisiteReadiness returns allSatisfied when all satisfied", () => {
  const prereqs = [
    { status: "satisfied", prerequisiteType: "approval_pack_exists" },
    { status: "waived", prerequisiteType: "security_review_complete" },
  ];
  const result = evaluateGatePrerequisiteReadiness(prereqs);
  assert.ok(result.allSatisfied);
  assert.ok(!result.anyBlocked);
  assert.ok(!result.anyFailed);
});

test("validateImplementationPlanningExportSafety rejects blocked fields", () => {
  assert.ok(!validateImplementationPlanningExportSafety('{"password": "secret"}'));
  assert.ok(!validateImplementationPlanningExportSafety('token: abc123'));
  assert.ok(validateImplementationPlanningExportSafety("This is a safe planning document."));
});

test("normalizeCreateImplementationPlanningWorkspaceInput requires workspaceId", () => {
  assert.throws(() => normalizeCreateImplementationPlanningWorkspaceInput({
    workspaceId: "",
    approvalPackId: "ap-1",
    title: "Test",
    summary: "Summary",
  }));
});

test("normalizePlanningDecisionInput requires rationale", () => {
  assert.throws(() => normalizePlanningDecisionInput({
    workspaceId: "ws-1",
    planningWorkspaceId: "pw-1",
    decision: "approve_plan_for_dry_run_planning",
    rationale: "",
  }));
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("registry: create and get planning workspace", async () => {
  _clearImplementationPlanningStores();
  const ws = await createAgentPmoImplementationPlanningWorkspace({
    workspaceId: "ws-1",
    approvalPackId: "ap-1",
    title: "Test Planning WS",
    summary: "Test summary",
    status: "created",
  });
  assert.ok(ws.id);
  assert.equal(ws.status, "created");
  const found = await getAgentPmoImplementationPlanningWorkspaceById("ws-1", ws.id);
  assert.equal(found?.id, ws.id);
});

test("registry: list planning workspaces filters by status", async () => {
  _clearImplementationPlanningStores();
  await createAgentPmoImplementationPlanningWorkspace({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS1", summary: "", status: "created" });
  await createAgentPmoImplementationPlanningWorkspace({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS2", summary: "", status: "planning" });
  const created = await listAgentPmoImplementationPlanningWorkspaces("ws-1", { status: "created" });
  assert.equal(created.length, 1);
});

test("registry: update workspace status", async () => {
  _clearImplementationPlanningStores();
  const ws = await createAgentPmoImplementationPlanningWorkspace({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "", status: "created" });
  const updated = await updateAgentPmoImplementationPlanningWorkspaceStatus("ws-1", ws.id, "planning");
  assert.equal(updated?.status, "planning");
});

test("registry: create plan draft with versioning", async () => {
  _clearImplementationPlanningStores();
  const draft1 = await createAgentPmoImplementationPlanDraft({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", implementationObjective: "obj", implementationScope: "scope", nonGoals: "none" });
  const draft2 = await createAgentPmoImplementationPlanDraft({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", implementationObjective: "obj2", implementationScope: "scope2", nonGoals: "none2" });
  assert.equal(draft1.planVersion, 1);
  assert.equal(draft2.planVersion, 2);
});

test("registry: create and list task breakdowns", async () => {
  _clearImplementationPlanningStores();
  await createAgentPmoImplementationTaskBreakdown({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", taskType: "safety_check", status: "planned", taskOrder: 1, title: "Safety", description: "Check safety" });
  const tasks = await listAgentPmoImplementationTaskBreakdowns("ws-1", { planningWorkspaceId: "pw-1" });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].taskType, "safety_check");
});

test("registry: checklist and items", async () => {
  _clearImplementationPlanningStores();
  const checklist = await createAgentPmoPreImplementationChecklist({ workspaceId: "ws-1", planningWorkspaceId: "pw-1" });
  await createAgentPmoPreImplementationChecklistItem({ workspaceId: "ws-1", checklistId: checklist.id, itemKey: "approval_pack_exists", itemLabel: "Approval pack exists", status: "passed" });
  const items = await listAgentPmoPreImplementationChecklistItems("ws-1", checklist.id);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "passed");
});

test("registry: stakeholder readiness CRUD", async () => {
  _clearImplementationPlanningStores();
  const record = await createAgentPmoStakeholderReadiness({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", stakeholderRole: "pmo_owner", status: "pending" });
  const updated = await updateAgentPmoStakeholderReadinessStatus("ws-1", record.id, "acknowledged");
  assert.equal(updated?.status, "acknowledged");
});

test("registry: change window plan CRUD", async () => {
  _clearImplementationPlanningStores();
  const plan = await createAgentPmoChangeWindowPlan({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", windowType: "standard" });
  assert.equal(plan.status, "draft");
  const updated = await updateAgentPmoChangeWindowStatus("ws-1", plan.id, "proposed");
  assert.equal(updated?.status, "proposed");
});

test("registry: implementation risk CRUD", async () => {
  _clearImplementationPlanningStores();
  const risk = await createAgentPmoImplementationRisk({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", riskType: "operational_risk", severity: "medium", riskSummary: "Test risk" });
  assert.equal(risk.status, "open");
  const updated = await updateAgentPmoImplementationRiskStatus("ws-1", risk.id, "mitigated");
  assert.equal(updated?.status, "mitigated");
});

test("registry: rollback rehearsal plan CRUD", async () => {
  _clearImplementationPlanningStores();
  const plan = await createAgentPmoRollbackRehearsalPlan({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", rehearsalType: "tabletop", rehearsalSummary: "Test rehearsal" });
  assert.equal(plan.status, "created");
  const updated = await updateAgentPmoRollbackRehearsalStatus("ws-1", plan.id, "planned");
  assert.equal(updated?.status, "planned");
});

test("registry: gate prerequisite CRUD", async () => {
  _clearImplementationPlanningStores();
  const prereq = await createAgentPmoImplementationGatePrerequisite({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", prerequisiteType: "approval_pack_exists", status: "pending" });
  assert.equal(prereq.status, "pending");
  const updated = await updateAgentPmoImplementationGatePrerequisiteStatus("ws-1", prereq.id, "satisfied");
  assert.equal(updated?.status, "satisfied");
});

test("registry: decisions are append-only", async () => {
  _clearImplementationPlanningStores();
  await recordAgentPmoImplementationPlanningDecision({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", decision: "approve_plan_for_dry_run_planning", rationale: "All checks passed" });
  await recordAgentPmoImplementationPlanningDecision({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", decision: "request_changes", rationale: "More info needed" });
  const decisions = await listAgentPmoImplementationPlanningDecisions("ws-1", { planningWorkspaceId: "pw-1" });
  assert.equal(decisions.length, 2);
});

test("registry: export create and get", async () => {
  _clearImplementationPlanningStores();
  const exp = await createAgentPmoImplementationPlanningExport({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", exportFormat: "markdown", status: "generated", fileName: "test.md", contentType: "text/markdown", contentText: "# Test" });
  const found = await getAgentPmoImplementationPlanningExportById("ws-1", exp.id);
  assert.equal(found?.id, exp.id);
});

test("registry: events are append-only", async () => {
  _clearImplementationPlanningStores();
  await recordAgentPmoImplementationPlanningEvent({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", eventType: "implementation_planning_workspace_created", message: "Created" });
  await recordAgentPmoImplementationPlanningEvent({ workspaceId: "ws-1", planningWorkspaceId: "pw-1", eventType: "implementation_plan_draft_created", message: "Draft created" });
  const events = await listAgentPmoImplementationPlanningEvents({ workspaceId: "ws-1", planningWorkspaceId: "pw-1" });
  assert.equal(events.length, 2);
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("service: createImplementationPlanningWorkspaceFromApprovalPack", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({
    workspaceId: "ws-1",
    approvalPackId: "ap-1",
    title: "Test WS",
    summary: "Planning workspace",
    actorId: "user-1",
  });
  assert.ok(ws.id);
  assert.equal(ws.status, "created");
  assert.equal(ws.approvalPackId, "ap-1");
  const events = await listAgentPmoImplementationPlanningEvents({ workspaceId: "ws-1" });
  assert.ok(events.some((e) => e.eventType === "implementation_planning_workspace_created"));
});

test("service: createImplementationPlanDraft", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const draft = await createImplementationPlanDraft({
    workspaceId: "ws-1",
    planningWorkspaceId: ws.id,
    implementationObjective: "Test objective",
    implementationScope: "Test scope",
    nonGoals: "Not this",
  });
  assert.ok(draft.id);
  assert.equal(draft.planVersion, 1);
  assert.equal(draft.implementationObjective, "Test objective");
});

test("service: generateImplementationTaskBreakdown creates 10 tasks", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const tasks = await generateImplementationTaskBreakdown({ workspaceId: "ws-1", planningWorkspaceId: ws.id });
  assert.equal(tasks.length, 10);
  assert.ok(tasks.some((t) => t.taskType === "dry_run_preparation"));
  assert.ok(tasks.some((t) => t.taskType === "policy_version_preparation"));
  assert.ok(tasks.every((t) => t.status === "planned"));
});

test("service: generatePreImplementationChecklist creates 18 items", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const { checklist, items } = await generatePreImplementationChecklist({ workspaceId: "ws-1", planningWorkspaceId: ws.id });
  assert.ok(checklist.id);
  assert.equal(items.length, 18);
  assert.equal(checklist.totalItems, 18);
  assert.ok(items.some((i) => i.itemKey === "no_live_policy_mutation"));
  assert.ok(items.some((i) => i.itemKey === "approval_pack_exists"));
});

test("service: recordStakeholderReadiness", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const record = await recordStakeholderReadiness({ workspaceId: "ws-1", planningWorkspaceId: ws.id, stakeholderRole: "pmo_owner", status: "acknowledged" });
  assert.equal(record.status, "acknowledged");
});

test("service: proposeChangeWindowPlan", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const plan = await proposeChangeWindowPlan({ workspaceId: "ws-1", planningWorkspaceId: ws.id, windowType: "maintenance" });
  assert.equal(plan.windowType, "maintenance");
  assert.equal(plan.status, "draft");
});

test("service: registerImplementationRisk", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const risk = await registerImplementationRisk({ workspaceId: "ws-1", planningWorkspaceId: ws.id, riskType: "compliance_risk", severity: "high", riskSummary: "Risk summary" });
  assert.equal(risk.riskType, "compliance_risk");
  assert.equal(risk.severity, "high");
  assert.equal(risk.status, "open");
});

test("service: createRollbackRehearsalPlan", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const plan = await createRollbackRehearsalPlan({ workspaceId: "ws-1", planningWorkspaceId: ws.id, rehearsalType: "tabletop", rehearsalSummary: "Rehearsal summary" });
  assert.equal(plan.rehearsalType, "tabletop");
  assert.equal(plan.status, "created");
});

test("service: evaluateImplementationGatePrerequisites creates 12 prerequisites", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const prereqs = await evaluateImplementationGatePrerequisites({ workspaceId: "ws-1", planningWorkspaceId: ws.id });
  assert.equal(prereqs.length, 12);
  assert.ok(prereqs.some((p) => p.prerequisiteType === "approval_pack_exists"));
  assert.ok(prereqs.some((p) => p.prerequisiteType === "data_governance_review_complete"));
});

test("service: recordImplementationPlanningDecision approve_plan updates workspace status", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  await recordImplementationPlanningDecision({ workspaceId: "ws-1", planningWorkspaceId: ws.id, decision: "approve_plan_for_dry_run_planning", rationale: "All checks passed" });
  const updated = await getAgentPmoImplementationPlanningWorkspaceById("ws-1", ws.id);
  assert.equal(updated?.status, "approved_for_dry_run_planning");
});

test("service: recordImplementationPlanningDecision request_changes updates workspace status", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  await recordImplementationPlanningDecision({ workspaceId: "ws-1", planningWorkspaceId: ws.id, decision: "request_changes", rationale: "Need more info" });
  const updated = await getAgentPmoImplementationPlanningWorkspaceById("ws-1", ws.id);
  assert.equal(updated?.status, "changes_requested");
});

test("service: generateImplementationPlanningExport markdown", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const exp = await generateImplementationPlanningExport({ workspaceId: "ws-1", planningWorkspaceId: ws.id, exportFormat: "markdown" });
  assert.equal(exp.exportFormat, "markdown");
  assert.equal(exp.status, "generated");
  assert.ok(exp.contentText?.includes("PLANNING DOCUMENT ONLY"));
  assert.ok(exp.contentText?.includes("NON-GOALS"));
});

test("service: generateImplementationPlanningExport json", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  const exp = await generateImplementationPlanningExport({ workspaceId: "ws-1", planningWorkspaceId: ws.id, exportFormat: "json" });
  assert.equal(exp.exportFormat, "json");
  assert.ok(exp.contentJson !== null);
});

test("service: archiveImplementationPlanningWorkspace", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  await archiveImplementationPlanningWorkspace({ workspaceId: "ws-1", planningWorkspaceId: ws.id, rationale: "No longer needed" });
  const updated = await getAgentPmoImplementationPlanningWorkspaceById("ws-1", ws.id);
  assert.equal(updated?.status, "archived");
});

test("service: buildImplementationPlanningSummary returns counts", async () => {
  _clearImplementationPlanningStores();
  await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS1", summary: "s" });
  await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-2", title: "WS2", summary: "s" });
  const summary = await buildImplementationPlanningSummary("ws-1");
  assert.equal(summary.totalWorkspaces, 2);
  assert.ok(summary.byStatus.created >= 2);
});

test("service: getImplementationPlanningData returns all related data", async () => {
  _clearImplementationPlanningStores();
  const ws = await createImplementationPlanningWorkspaceFromApprovalPack({ workspaceId: "ws-1", approvalPackId: "ap-1", title: "WS", summary: "s" });
  await generateImplementationTaskBreakdown({ workspaceId: "ws-1", planningWorkspaceId: ws.id });
  const data = await getImplementationPlanningData({ workspaceId: "ws-1", planningWorkspaceId: ws.id });
  assert.ok(data.workspace);
  assert.equal(data.taskBreakdown.length, 10);
  assert.ok(data.summary.totalWorkspaces >= 1);
});

// ─── Migration File Tests ─────────────────────────────────────────────────────

test("migration file contains all expected table names", () => {
  const tables = [
    "agent_pmo_approval_packs",
    "agent_pmo_signoff_packets",
    "agent_pmo_implementation_ticket_drafts",
    "agent_pmo_implementation_planning_workspaces",
    "agent_pmo_implementation_plan_drafts",
    "agent_pmo_implementation_task_breakdowns",
    "agent_pmo_pre_implementation_checklists",
    "agent_pmo_pre_implementation_checklist_items",
    "agent_pmo_stakeholder_readiness_records",
    "agent_pmo_change_window_plans",
    "agent_pmo_implementation_risks",
    "agent_pmo_rollback_rehearsal_plans",
    "agent_pmo_implementation_gate_prerequisites",
    "agent_pmo_implementation_planning_decisions",
    "agent_pmo_implementation_planning_exports",
    "agent_pmo_implementation_planning_events",
  ];
  for (const table of tables) {
    assert.ok(migrationFile.includes(table), `missing table: ${table}`);
  }
});

test("migration file has RLS policies and no using true", () => {
  assert.ok(migrationFile.includes("enable row level security"));
  assert.ok(!migrationFile.includes("using (true)"), "Should not have using (true)");
  assert.ok(migrationFile.includes("workspace_memberships"));
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("database contract has all new row types", () => {
  const types = [
    "AgentPmoApprovalPackRow",
    "AgentPmoSignoffPacketRow",
    "AgentPmoImplementationTicketDraftRow",
    "AgentPmoImplementationPlanningWorkspaceRow",
    "AgentPmoImplementationPlanDraftRow",
    "AgentPmoImplementationTaskBreakdownRow",
    "AgentPmoPreImplementationChecklistRow",
    "AgentPmoPreImplementationChecklistItemRow",
    "AgentPmoStakeholderReadinessRow",
    "AgentPmoChangeWindowPlanRow",
    "AgentPmoImplementationRiskRow",
    "AgentPmoRollbackRehearsalPlanRow",
    "AgentPmoImplementationGatePrerequisiteRow",
    "AgentPmoImplementationPlanningDecisionRow",
    "AgentPmoImplementationPlanningExportRow",
    "AgentPmoImplementationPlanningEventRow",
  ];
  for (const t of types) {
    assert.ok(contractFile.includes(t), `missing row type: ${t}`);
  }
});

test("database contract version includes controlled-policy-implementation-planning-workspace", () => {
  assert.ok(contractFile.includes("controlled-policy-implementation-planning-workspace"));
});

// ─── Index Exports Tests ──────────────────────────────────────────────────────

test("index.ts exports all required functions", () => {
  const exports = [
    "validateAgentPmoImplementationPlanningWorkspaceStatus",
    "validateAgentPmoImplementationTaskType",
    "assertImplementationPlanningPayloadSerializable",
    "redactImplementationPlanningPayload",
    "_clearImplementationPlanningStores",
    "createAgentPmoImplementationPlanningWorkspace",
    "listAgentPmoImplementationPlanningWorkspaces",
    "createImplementationPlanningWorkspaceFromApprovalPack",
    "generateImplementationTaskBreakdown",
    "generatePreImplementationChecklist",
    "recordImplementationPlanningDecision",
    "generateImplementationPlanningExport",
    "buildImplementationPlanningSummary",
  ];
  for (const fn of exports) {
    assert.ok(indexFile.includes(fn), `index.ts missing export: ${fn}`);
  }
});

// ─── Observability Types Tests ────────────────────────────────────────────────

test("observability types include new planning event types", () => {
  const events = [
    "pmo_implementation_planning_workspace_created",
    "pmo_implementation_plan_draft_created",
    "pmo_implementation_task_breakdown_created",
    "pmo_pre_implementation_checklist_created",
    "pmo_pre_implementation_checklist_item_recorded",
    "pmo_stakeholder_readiness_recorded",
    "pmo_change_window_plan_created",
    "pmo_implementation_risk_registered",
    "pmo_rollback_rehearsal_plan_created",
    "pmo_implementation_gate_prerequisite_recorded",
    "pmo_implementation_planning_decision_recorded",
    "pmo_implementation_planning_export_created",
    "pmo_implementation_planning_workspace_archived",
  ];
  for (const e of events) {
    assert.ok(obsFile.includes(e), `missing observability event: ${e}`);
  }
});

test("observability types include new source type", () => {
  assert.ok(obsFile.includes("agent_controlled_policy_implementation_planning_workspace"));
});

// ─── Prohibited Behavior Tests ────────────────────────────────────────────────

test("service does not call openai/anthropic/gemini/embedding", () => {
  // Check for actual imports/calls, not just mentions in comments
  assert.ok(!serviceFile.includes("from 'openai'") && !serviceFile.includes('from "openai"'), "service must not import openai");
  assert.ok(!serviceFile.includes("from '@anthropic-ai'") && !serviceFile.includes('from "@anthropic-ai"'), "service must not import anthropic");
  assert.ok(!serviceFile.includes("from 'gemini'") && !serviceFile.includes('from "gemini"'), "service must not import gemini");
  assert.ok(!serviceFile.includes("createEmbedding") && !serviceFile.includes("embeddings.create"), "service must not call embedding");
});

test("service does not call fetch()", () => {
  // Check that fetch is not called (not just mentioned in comments)
  const lines = serviceFile.split("\n").filter(l => !l.trim().startsWith("//"));
  const nonCommentCode = lines.join("\n");
  assert.ok(!nonCommentCode.includes("fetch("), "service must not call fetch()");
});

test("service does not send email/slack/jira/calendar", () => {
  assert.ok(!serviceFile.includes("sendEmail"), "service must not send email");
  assert.ok(!serviceFile.includes("sendSlack"), "service must not send slack");
  assert.ok(!serviceFile.includes("createJira"), "service must not create jira");
  assert.ok(!serviceFile.includes("createCalendar"), "service must not create calendar");
});

test("service does not apply/mutate/activate/deploy policies", () => {
  assert.ok(!serviceFile.includes("applyPolicy"), "service must not call applyPolicy");
  assert.ok(!serviceFile.includes("mutatePolicy"), "service must not call mutatePolicy");
  assert.ok(!serviceFile.includes("activatePolicy"), "service must not call activatePolicy");
  assert.ok(!serviceFile.includes("deployPolicy"), "service must not call deployPolicy");
});

test("service does not run dry-runs or execute rollback", () => {
  assert.ok(!serviceFile.includes("runDryRun"), "service must not call runDryRun");
  assert.ok(!serviceFile.includes("executeRollback"), "service must not call executeRollback");
});

test("service does not have raw_payload/outcomePayload/failureMessage", () => {
  assert.ok(!serviceFile.includes("raw_payload"), "service must not use raw_payload");
  assert.ok(!serviceFile.includes("outcomePayload"), "service must not use outcomePayload");
  assert.ok(!serviceFile.includes("failureMessage"), "service must not use failureMessage");
  assert.ok(!serviceFile.includes("correctionReason"), "service must not use correctionReason");
});

// ─── Regression Tests ─────────────────────────────────────────────────────────

test("regression: backlog test file still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "tests/agent-pmo-governance-proposal-review-controlled-policy-change-backlog.test.mjs")),
    "backlog test file should still exist"
  );
});

test("regression: backlog types file still exists", () => {
  assert.ok(
    existsSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-backlog-types.ts")),
    "backlog types file should still exist"
  );
});
