// ─── Agent Controlled Policy Version Activation & Rollback Gate — Tests ──────
// No LLM calls. No external API calls. No adapter execution. No Supabase.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── Source Files ─────────────────────────────────────────────────────────────

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260812000000_agent_controlled_policy_version_activation_rollback_gate.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-policy-version-activation-rollback-gate.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-policy-version-activation-rollback-gate.md"), "utf8")
  : null;

// ─── Pure validation import ────────────────────────────────────────────────────

const {
  validateAgentPmoPolicyActivationRequestStatus,
  validateAgentPmoControlledPolicyVersionStatus,
  validateAgentPmoPolicyRollbackRequestStatus,
  evaluatePolicyActivationPreconditions,
  evaluatePolicyActivationGateReadiness,
  evaluateRollbackReadiness,
  sanitizePolicyActivationText,
  redactPolicyActivationPayload,
  assertPolicyActivationPayloadSerializable,
  validatePolicyActivationExportSafety,
} = await import(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-validation.ts"));

// ─── Registry import ───────────────────────────────────────────────────────────

const {
  _clearPolicyActivationStores,
  createAgentPmoPolicyActivationRequest,
  getAgentPmoPolicyActivationRequestById,
  listAgentPmoPolicyActivationRequests,
  createAgentPmoControlledPolicyVersion,
  getAgentPmoControlledPolicyVersionById,
  listAgentPmoControlledPolicyVersions,
  upsertAgentPmoActivePolicyPointer,
  listAgentPmoActivePolicyPointers,
  createAgentPmoPolicyActivationGate,
  listAgentPmoPolicyActivationGates,
  recordAgentPmoPolicyActivationGateDecision,
  listAgentPmoPolicyActivationGateDecisions,
  createAgentPmoPolicyActivationPrecondition,
  listAgentPmoPolicyActivationPreconditions,
  createAgentPmoPolicyRollbackRequest,
  getAgentPmoPolicyRollbackRequestById,
  listAgentPmoPolicyRollbackRequests,
  createAgentPmoPolicyRollbackGate,
  listAgentPmoPolicyRollbackGates,
  recordAgentPmoPolicyRollbackGateDecision,
  listAgentPmoPolicyRollbackGateDecisions,
  recordAgentPmoPolicyActivationAuditEntry,
  listAgentPmoPolicyActivationAuditEntries,
  recordAgentPmoPolicyActivationEvent,
  listAgentPmoPolicyActivationEvents,
} = await import(resolve(ROOT, "src/lib/agents/agent-pmo-policy-activation-registry.ts"));

// ─── Type Shape Tests ─────────────────────────────────────────────────────────

test("types file defines all required status union types", () => {
  assert.ok(typesFile.includes("AgentPmoPolicyActivationRequestStatus"), "missing AgentPmoPolicyActivationRequestStatus");
  assert.ok(typesFile.includes("AgentPmoControlledPolicyVersionStatus"), "missing AgentPmoControlledPolicyVersionStatus");
  assert.ok(typesFile.includes("AgentPmoPolicyRollbackRequestStatus"), "missing AgentPmoPolicyRollbackRequestStatus");
  assert.ok(typesFile.includes("AgentPmoPolicyActivationGateDecisionType"), "missing AgentPmoPolicyActivationGateDecisionType");
  assert.ok(typesFile.includes("AgentPmoPostActivationMonitoringHookType"), "missing AgentPmoPostActivationMonitoringHookType");
  assert.ok(typesFile.includes("AgentPmoPolicyActivationExportFormat"), "missing AgentPmoPolicyActivationExportFormat");
});

test("types file defines all required record types", () => {
  const requiredTypes = [
    "AgentPmoPolicyActivationRequestRecord",
    "AgentPmoPolicyActivationPreconditionRecord",
    "AgentPmoPolicyActivationGateRecord",
    "AgentPmoPolicyActivationGateDecisionRecord",
    "AgentPmoControlledPolicyVersionRecord",
    "AgentPmoActivePolicyPointerRecord",
    "AgentPmoPolicyActivationExecutionRecord",
    "AgentPmoPolicyRollbackRequestRecord",
    "AgentPmoPolicyRollbackGateRecord",
    "AgentPmoPolicyRollbackGateDecisionRecord",
    "AgentPmoPolicyRollbackExecutionRecord",
    "AgentPmoPolicyRollbackVerificationRecord",
    "AgentPmoPolicyActivationAuditEntryRecord",
    "AgentPmoPostActivationMonitoringHookRecord",
    "AgentPmoPolicyActivationExportRecord",
    "AgentPmoPolicyActivationEventRecord",
  ];
  for (const t of requiredTypes) {
    assert.ok(typesFile.includes(t), `missing type: ${t}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("validateAgentPmoPolicyActivationRequestStatus accepts valid statuses", () => {
  const valid = [
    "preconditions_pending", "preconditions_failed",
    "ready_for_activation_review", "activation_approved",
    "activation_rejected", "activated", "activation_failed",
    "rollback_available", "rollback_requested",
    "rolled_back", "blocked", "archived",
  ];
  for (const s of valid) {
    assert.ok(validateAgentPmoPolicyActivationRequestStatus(s), `should accept: ${s}`);
  }
});

test("validateAgentPmoPolicyActivationRequestStatus rejects invalid", () => {
  assert.strictEqual(validateAgentPmoPolicyActivationRequestStatus("pending"), false);
  assert.strictEqual(validateAgentPmoPolicyActivationRequestStatus(""), false);
  assert.strictEqual(validateAgentPmoPolicyActivationRequestStatus(null), false);
});

test("validateAgentPmoControlledPolicyVersionStatus accepts valid statuses", () => {
  const valid = ["created", "ready_for_activation", "active", "superseded", "rolled_back", "blocked", "archived"];
  for (const s of valid) {
    assert.ok(validateAgentPmoControlledPolicyVersionStatus(s), `should accept: ${s}`);
  }
});

test("evaluatePolicyActivationPreconditions returns passed when all pass", () => {
  const result = evaluatePolicyActivationPreconditions({ total: 5, passed: 5, failed: 0, blocked: 0, waived: 0 });
  assert.strictEqual(result, "passed");
});

test("evaluatePolicyActivationPreconditions returns failed when any fail", () => {
  const result = evaluatePolicyActivationPreconditions({ total: 5, passed: 3, failed: 2, blocked: 0, waived: 0 });
  assert.strictEqual(result, "failed");
});

test("evaluatePolicyActivationPreconditions returns blocked when any blocked", () => {
  const result = evaluatePolicyActivationPreconditions({ total: 5, passed: 4, failed: 0, blocked: 1, waived: 0 });
  assert.strictEqual(result, "blocked");
});

test("evaluatePolicyActivationPreconditions returns pending when not all pass", () => {
  const result = evaluatePolicyActivationPreconditions({ total: 5, passed: 3, failed: 0, blocked: 0, waived: 0 });
  assert.strictEqual(result, "pending");
});

test("evaluatePolicyActivationGateReadiness returns true only for ready_for_activation_review", () => {
  assert.strictEqual(evaluatePolicyActivationGateReadiness("ready_for_activation_review"), true);
  assert.strictEqual(evaluatePolicyActivationGateReadiness("preconditions_pending"), false);
  assert.strictEqual(evaluatePolicyActivationGateReadiness("activated"), false);
});

test("sanitizePolicyActivationText trims and respects maxLength", () => {
  const result = sanitizePolicyActivationText("  hello world  ", 5);
  assert.strictEqual(result, "hello");
});

test("redactPolicyActivationPayload removes blocked keys", () => {
  const payload = { name: "test", password: "secret123", apiKey: "abc" };
  const redacted = redactPolicyActivationPayload(payload);
  assert.ok(!JSON.stringify(redacted).includes("secret123"), "should redact password");
  assert.ok(!JSON.stringify(redacted).includes("abc"), "should redact apiKey");
  assert.ok(JSON.stringify(redacted).includes("test"), "should keep safe fields");
});

test("assertPolicyActivationPayloadSerializable throws on oversized payload", () => {
  const big = { data: "x".repeat(60_000) };
  assert.throws(() => assertPolicyActivationPayloadSerializable(big), /50KB/);
});

test("validatePolicyActivationExportSafety blocks forbidden patterns", () => {
  const result = validatePolicyActivationExportSafety("sendEmail(user@example.com)");
  assert.strictEqual(result.safe, false);
  assert.ok(result.blockedPatterns.length > 0, "should report blocked patterns");
});

test("validatePolicyActivationExportSafety blocks sensitive keys", () => {
  const result = validatePolicyActivationExportSafety('"password": "hunter2"');
  assert.strictEqual(result.safe, false);
});

test("validatePolicyActivationExportSafety passes clean content", () => {
  const result = validatePolicyActivationExportSafety("Policy activation summary: all checks passed.");
  assert.strictEqual(result.safe, true);
  assert.strictEqual(result.blockedPatterns.length, 0);
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("registry: activation request create/get/list round-trip", async () => {
  _clearPolicyActivationStores();
  const req = await createAgentPmoPolicyActivationRequest({
    workspaceId: "ws-1",
    dryRunRequestId: "dry-1",
    requestReason: "Testing activation flow",
    requestedBy: "user-1",
  });
  assert.ok(req.id);
  assert.strictEqual(req.workspaceId, "ws-1");
  assert.strictEqual(req.dryRunRequestId, "dry-1");

  const fetched = await getAgentPmoPolicyActivationRequestById(req.id);
  assert.ok(fetched);
  assert.strictEqual(fetched.id, req.id);

  const list = await listAgentPmoPolicyActivationRequests("ws-1");
  assert.ok(list.some(r => r.id === req.id));
});

test("registry: controlled policy version create/get/list", async () => {
  _clearPolicyActivationStores();
  const ver = await createAgentPmoControlledPolicyVersion({
    workspaceId: "ws-1",
    activationRequestId: "req-1",
    policyArea: "scoring",
    versionLabel: "v1.0",
    versionNumber: 1,
    versionStatus: "ready_for_activation",
  });
  assert.ok(ver.id);
  assert.strictEqual(ver.versionStatus, "ready_for_activation");

  const fetched = await getAgentPmoControlledPolicyVersionById(ver.id);
  assert.ok(fetched);

  const list = await listAgentPmoControlledPolicyVersions("ws-1");
  assert.ok(list.some(v => v.id === ver.id));
});

test("registry: active policy pointer upsert preserves previous version", async () => {
  _clearPolicyActivationStores();
  const ptr1 = await upsertAgentPmoActivePolicyPointer({
    workspaceId: "ws-1",
    policyArea: "routing",
    activePolicyVersionId: "ver-1",
    previousPolicyVersionId: null,
    actorId: "user-1",
  });
  assert.strictEqual(ptr1.activePolicyVersionId, "ver-1");
  assert.strictEqual(ptr1.previousPolicyVersionId, null);

  const ptr2 = await upsertAgentPmoActivePolicyPointer({
    workspaceId: "ws-1",
    policyArea: "routing",
    activePolicyVersionId: "ver-2",
    previousPolicyVersionId: "ver-1",
    actorId: "user-1",
  });
  assert.strictEqual(ptr2.activePolicyVersionId, "ver-2");
  assert.strictEqual(ptr2.previousPolicyVersionId, "ver-1");

  const list = await listAgentPmoActivePolicyPointers("ws-1");
  assert.strictEqual(list.filter(p => p.policyArea === "routing").length, 1, "should only have one pointer per area");
});

test("registry: gate create and decision record append-only", async () => {
  _clearPolicyActivationStores();
  const gate = await createAgentPmoPolicyActivationGate({
    workspaceId: "ws-1",
    activationRequestId: "req-1",
    actorId: "user-1",
  });
  assert.ok(gate.id);

  await recordAgentPmoPolicyActivationGateDecision({
    workspaceId: "ws-1",
    activationGateId: gate.id,
    activationRequestId: "req-1",
    decisionType: "approve_for_activation",
    rationale: "All checks passed",
    actorId: "user-1",
  });

  const decisions = await listAgentPmoPolicyActivationGateDecisions("ws-1");
  assert.ok(decisions.length >= 1);
  assert.ok(decisions.some(d => d.decisionType === "approve_for_activation"));
});

test("registry: rollback request create/get/list", async () => {
  _clearPolicyActivationStores();
  const req = await createAgentPmoPolicyRollbackRequest({
    workspaceId: "ws-1",
    activationRequestId: "req-1",
    controlledPolicyVersionId: "ver-1",
    activePolicyPointerId: null,
    requestReason: "Policy causing routing errors",
    requestedBy: "user-1",
  });
  assert.ok(req.id);
  assert.strictEqual(req.requestReason, "Policy causing routing errors");

  const fetched = await getAgentPmoPolicyRollbackRequestById(req.id);
  assert.ok(fetched);

  const list = await listAgentPmoPolicyRollbackRequests("ws-1");
  assert.ok(list.some(r => r.id === req.id));
});

test("registry: audit entries are append-only", async () => {
  _clearPolicyActivationStores();
  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: "ws-1",
    activationRequestId: "req-1",
    entryType: "activation_request_created",
    summary: "Request created",
    actorId: "user-1",
  });
  await recordAgentPmoPolicyActivationAuditEntry({
    workspaceId: "ws-1",
    activationRequestId: "req-1",
    entryType: "activation_preconditions_completed",
    summary: "Preconditions done",
    actorId: "user-1",
  });
  const entries = await listAgentPmoPolicyActivationAuditEntries("ws-1");
  assert.ok(entries.length >= 2, "should accumulate audit entries");
});

test("registry: events are append-only", async () => {
  _clearPolicyActivationStores();
  await recordAgentPmoPolicyActivationEvent({
    workspaceId: "ws-1",
    activationRequestId: "req-1",
    eventType: "pmo_policy_activation_request_created",
    payload: { action: "created" },
    actorId: "user-1",
  });
  const events = await listAgentPmoPolicyActivationEvents("ws-1");
  assert.ok(events.length >= 1);
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration creates all 16 required tables", () => {
  const tables = [
    "agent_pmo_policy_activation_requests",
    "agent_pmo_policy_activation_preconditions",
    "agent_pmo_policy_activation_gates",
    "agent_pmo_policy_activation_gate_decisions",
    "agent_pmo_controlled_policy_versions",
    "agent_pmo_active_policy_pointers",
    "agent_pmo_policy_activation_executions",
    "agent_pmo_policy_rollback_requests",
    "agent_pmo_policy_rollback_gates",
    "agent_pmo_policy_rollback_gate_decisions",
    "agent_pmo_policy_rollback_executions",
    "agent_pmo_policy_rollback_verifications",
    "agent_pmo_policy_activation_audit_entries",
    "agent_pmo_post_activation_monitoring_hooks",
    "agent_pmo_policy_activation_exports",
    "agent_pmo_policy_activation_events",
  ];
  for (const t of tables) {
    assert.ok(migrationFile.includes(t), `missing table: ${t}`);
  }
});

test("migration has RLS enabled on all tables", () => {
  const enableCount = (migrationFile.match(/enable row level security/gi) ?? []).length;
  assert.ok(enableCount >= 16, `expected at least 16 RLS enables, got ${enableCount}`);
});

test("migration has unique constraint on active policy pointers (workspace + policy_area)", () => {
  assert.ok(
    migrationFile.includes("agent_pmo_active_policy_pointers_workspace_area_unique"),
    "missing unique constraint on active policy pointers",
  );
});

test("migration has no 'using true' RLS policies", () => {
  assert.ok(!migrationFile.match(/using\s*\(\s*true\s*\)/i), "found forbidden 'using (true)' RLS policy");
});

test("migration has no public access policies", () => {
  assert.ok(!migrationFile.includes("anon"), "should not grant anon access");
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("database contract has all 16 Row types for this sprint", () => {
  const rows = [
    "AgentPmoPolicyActivationRequestRow",
    "AgentPmoPolicyActivationPreconditionRow",
    "AgentPmoPolicyActivationGateRow",
    "AgentPmoPolicyActivationGateDecisionRow",
    "AgentPmoControlledPolicyVersionRow",
    "AgentPmoActivePolicyPointerRow",
    "AgentPmoPolicyActivationExecutionRow",
    "AgentPmoPolicyRollbackRequestRow",
    "AgentPmoPolicyRollbackGateRow",
    "AgentPmoPolicyRollbackGateDecisionRow",
    "AgentPmoPolicyRollbackExecutionRow",
    "AgentPmoPolicyRollbackVerificationRow",
    "AgentPmoPolicyActivationAuditEntryRow",
    "AgentPmoPostActivationMonitoringHookRow",
    "AgentPmoPolicyActivationExportRow",
    "AgentPmoPolicyActivationEventRow",
  ];
  for (const r of rows) {
    assert.ok(contractFile.includes(r), `missing contract row type: ${r}`);
  }
});

test("database contract version includes sprint identifier", () => {
  assert.ok(
    contractFile.includes("controlled-policy-version-activation-rollback-gate"),
    "contract version should reference this sprint",
  );
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability file has new audit event types for this sprint", () => {
  const events = [
    "pmo_policy_activation_request_created",
    "pmo_policy_activation_gate_created",
    "pmo_policy_activation_gate_decision_recorded",
    "pmo_policy_activation_execution_completed",
    "pmo_policy_activation_request_archived",
  ];
  for (const e of events) {
    assert.ok(obsFile.includes(e), `missing audit event type: ${e}`);
  }
});

test("observability file has new source type for this sprint", () => {
  assert.ok(
    obsFile.includes("agent_controlled_policy_version_activation_rollback_gate"),
    "missing source type",
  );
});

// ─── Index.ts Export Tests ────────────────────────────────────────────────────

test("index.ts exports key service functions", () => {
  const fns = [
    "createPolicyActivationRequestFromDryRun",
    "evaluatePolicyActivationPreconditionsService",
    "createPolicyActivationGate",
    "recordPolicyActivationGateDecision",
    "createControlledPolicyVersion",
    "executePolicyActivation",
    "createPolicyRollbackRequest",
    "createPolicyRollbackGate",
    "recordPolicyRollbackGateDecision",
    "executePolicyRollback",
    "verifyPolicyRollback",
    "createPostActivationMonitoringHooks",
    "generatePolicyActivationExport",
    "archivePolicyActivationRequest",
    "buildPolicyActivationSummary",
    "getPolicyActivationData",
  ];
  for (const fn of fns) {
    assert.ok(indexFile.includes(fn), `missing export: ${fn}`);
  }
});

// ─── Prohibited Behavior Tests ────────────────────────────────────────────────

test("service does not call LLM providers", () => {
  assert.ok(!serviceFile.includes("openai"), "must not call OpenAI");
  assert.ok(!serviceFile.includes("anthropic"), "must not call Anthropic");
  assert.ok(!serviceFile.includes("callOpenAI"), "must not call callOpenAI");
  assert.ok(!serviceFile.includes("callGemini"), "must not call callGemini");
});

test("service does not send notifications or create external tickets", () => {
  assert.ok(!serviceFile.includes("sendEmail"), "must not send email");
  assert.ok(!serviceFile.includes("sendSlack"), "must not send Slack");
  assert.ok(!serviceFile.includes("createJiraTicket"), "must not create Jira tickets");
  assert.ok(!serviceFile.includes("createGitHubIssue"), "must not create GitHub issues");
});

test("service does not execute adapters or call external APIs", () => {
  assert.ok(!serviceFile.includes("executeAdapter"), "must not execute adapters");
  assert.ok(!serviceFile.includes("callExternalApi"), "must not call external APIs");
  assert.ok(!serviceFile.includes("fetch("), "must not use fetch in service");
});

test("service does not store raw payloads or credentials", () => {
  assert.ok(!serviceFile.includes("raw_payload"), "must not store raw payloads");
  assert.ok(!serviceFile.includes("store_secret"), "must not store secrets");
});

test("validation blocks forbidden executable patterns", () => {
  const forbidden = ["sendEmail", "sendSlack", "createJiraTicket", "callOpenAI", "executeAdapter"];
  for (const f of forbidden) {
    assert.ok(validationFile.includes(f), `validation should reference forbidden pattern: ${f}`);
  }
});

test("validation has BLOCKED_KEYS set", () => {
  assert.ok(validationFile.includes("BLOCKED_KEYS"), "validation should define BLOCKED_KEYS");
  assert.ok(validationFile.includes("password"), "BLOCKED_KEYS should include password");
  assert.ok(validationFile.includes("secret"), "BLOCKED_KEYS should include secret");
  assert.ok(validationFile.includes("token"), "BLOCKED_KEYS should include token");
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

test("no forbidden terminology in service", () => {
  const forbidden = ["magic", "automate", "auto-approve", "bypass", "skip gate", "skip approval"];
  for (const word of forbidden) {
    assert.ok(!serviceFile.toLowerCase().includes(word), `forbidden term found: ${word}`);
  }
});

// ─── API Route Tests ──────────────────────────────────────────────────────────

test("all required API route files exist", () => {
  const routes = [
    "src/app/api/agents/execution/policy-activation/from-dry-run/route.ts",
    "src/app/api/agents/execution/policy-activation/requests/route.ts",
    "src/app/api/agents/execution/policy-activation/preconditions/route.ts",
    "src/app/api/agents/execution/policy-activation/gates/route.ts",
    "src/app/api/agents/execution/policy-activation/gate-decisions/route.ts",
    "src/app/api/agents/execution/policy-activation/controlled-versions/route.ts",
    "src/app/api/agents/execution/policy-activation/active-pointers/route.ts",
    "src/app/api/agents/execution/policy-activation/execute/route.ts",
    "src/app/api/agents/execution/policy-activation/executions/route.ts",
    "src/app/api/agents/execution/policy-activation/rollback-requests/route.ts",
    "src/app/api/agents/execution/policy-activation/rollback-gates/route.ts",
    "src/app/api/agents/execution/policy-activation/rollback-gate-decisions/route.ts",
    "src/app/api/agents/execution/policy-activation/rollback-execute/route.ts",
    "src/app/api/agents/execution/policy-activation/rollback-executions/route.ts",
    "src/app/api/agents/execution/policy-activation/rollback-verifications/route.ts",
    "src/app/api/agents/execution/policy-activation/monitoring-hooks/route.ts",
    "src/app/api/agents/execution/policy-activation/audit/route.ts",
    "src/app/api/agents/execution/policy-activation/exports/route.ts",
    "src/app/api/agents/execution/policy-activation/summary/route.ts",
    "src/app/api/agents/execution/policy-activation/data/route.ts",
    "src/app/api/agents/execution/policy-activation/events/route.ts",
  ];
  for (const r of routes) {
    assert.ok(existsSync(resolve(ROOT, r)), `missing route: ${r}`);
  }
});
