// ─── Controlled Execution Finalization & Adapter Dispatch Gate — Tests ─────────
// No LLM calls. No external API calls. No real side effects. No adapter execution.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const typesFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-dispatch-types.ts"), "utf8");
const validationFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-dispatch-validation.ts"), "utf8");
const registryFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-dispatch-registry.ts"), "utf8");
const serviceFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-dispatch-service.ts"), "utf8");
const migrationFile = readFileSync(resolve(ROOT, "supabase/migrations/20260804000000_agent_controlled_execution_finalization_adapter_dispatch_gate.sql"), "utf8");
const contractFile = readFileSync(resolve(ROOT, "src/lib/db/database-contract.ts"), "utf8");
const indexFile = readFileSync(resolve(ROOT, "src/lib/agents/index.ts"), "utf8");
const obsFile = readFileSync(resolve(ROOT, "src/lib/agents/agent-observability-types.ts"), "utf8");
const docsFile = existsSync(resolve(ROOT, "docs/agent-controlled-execution-finalization-adapter-dispatch-gate.md"))
  ? readFileSync(resolve(ROOT, "docs/agent-controlled-execution-finalization-adapter-dispatch-gate.md"), "utf8")
  : "";

const {
  validateAgentExecutionFinalizationStatus,
  validateAgentExecutionDispatchReadiness,
  validateAgentExecutionDispatchGateStatus,
  validateAgentExecutionLockStatus,
  validateAgentExecutionIdempotencyStatus,
  validateAgentExecutionDispatchAttemptStatus,
  validateAgentExecutionFinalConfirmationRequirement,
  validateAgentExecutionFinalConfirmationStatus,
  validateAgentExecutionSideEffectMode,
  validateAgentExecutionDispatchEventType,
  validateAgentExecutionDispatchCheckType,
  assertExecutionDispatchPayloadSerializable,
  redactExecutionDispatchPayload,
  normalizeCreateAgentExecutionFinalizationInput,
  normalizeConfirmAgentExecutionDispatchInput,
  normalizeDispatchAgentExecutionInput,
  dedupeDispatchStrings,
  createDispatchIdempotencyKey,
  createDispatchFingerprint,
  evaluateDispatchSideEffectMode,
  evaluateFinalConfirmationRequirement,
  calculateDispatchReadiness,
} = await import("../src/lib/agents/agent-execution-dispatch-validation.ts");

const {
  createAgentExecutionFinalization,
  getAgentExecutionFinalizationById,
  getAgentExecutionFinalizationByExecutionRequestId,
  listAgentExecutionFinalizations,
  updateAgentExecutionFinalizationStatus,
  createAgentExecutionDispatchGate,
  getAgentExecutionDispatchGateByFinalizationId,
  acquireAgentExecutionDispatchLock,
  releaseAgentExecutionDispatchLock,
  getAgentExecutionDispatchLockByKey,
  createOrGetAgentExecutionDispatchIdempotency,
  updateAgentExecutionDispatchIdempotencyStatus,
  createAgentExecutionDispatchAttempt,
  updateAgentExecutionDispatchAttemptStatus,
  createAgentExecutionFinalConfirmation,
  confirmAgentExecutionFinalConfirmation,
  getAgentExecutionFinalConfirmationByFinalizationId,
  recordAgentExecutionDispatchEvent,
  listAgentExecutionDispatchEvents,
  _clearDispatchStores,
} = await import("../src/lib/agents/agent-execution-dispatch-registry.ts");

const {
  createFinalizationFromExecutionRequest,
  runExecutionDispatchReadiness,
  createExecutionDispatchGate,
  recordFinalDispatchConfirmation,
  dispatchExecutionToAdapter,
  cancelExecutionDispatch,
  buildExecutionDispatchSummary,
  getDispatchAdapterMapping,
} = await import("../src/lib/agents/agent-execution-dispatch-service.ts");

// ─── Type / Union Tests ───────────────────────────────────────────────────────

test("finalization statuses — all values present in types file", () => {
  const statuses = [
    "created","readiness_pending","readiness_passed","readiness_failed",
    "confirmation_required","confirmation_satisfied","dispatch_ready","dispatch_blocked",
    "dispatch_started","dispatch_succeeded","dispatch_failed","result_reconciled","cancelled","completed",
  ];
  for (const s of statuses) {
    assert.ok(typesFile.includes(`"${s}"`), `Missing finalization status: ${s}`);
  }
});

test("dispatch readiness values — all present in types file", () => {
  for (const v of ["not_ready","ready","blocked","requires_confirmation","dispatching","dispatched","reconciled"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing readiness: ${v}`);
  }
});

test("dispatch gate statuses — all present in types file", () => {
  for (const v of ["created","allowed","blocked","confirmation_required","locked","idempotent_replay","dispatching","succeeded","failed","cancelled"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing gate status: ${v}`);
  }
});

test("lock statuses — all present in types file", () => {
  for (const v of ["available","acquired","released","expired","blocked"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing lock status: ${v}`);
  }
});

test("idempotency statuses — all present in types file", () => {
  for (const v of ["new","in_progress","completed","replayed","conflict","failed"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing idempotency status: ${v}`);
  }
});

test("dispatch attempt statuses — all present in types file", () => {
  for (const v of ["created","started","adapter_succeeded","adapter_failed","result_reconciled","blocked","cancelled"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing attempt status: ${v}`);
  }
});

test("final confirmation requirements — all present in types file", () => {
  for (const v of ["not_required","required","required_high_risk","required_critical_risk","required_side_effect_potential","required_policy"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing confirmation requirement: ${v}`);
  }
});

test("final confirmation statuses — all present in types file", () => {
  for (const v of ["not_required","required","pending","confirmed","rejected","expired","cancelled"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing confirmation status: ${v}`);
  }
});

test("side effect modes — all present in types file", () => {
  for (const v of ["none","draft_only","dry_run","side_effect_potential","side_effect_blocked"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing side effect mode: ${v}`);
  }
});

test("dispatch event types — all present in types file", () => {
  for (const v of ["finalization_created","dispatch_gate_created","adapter_dispatch_started","adapter_dispatch_succeeded","dispatch_completed"]) {
    assert.ok(typesFile.includes(`"${v}"`), `Missing event type: ${v}`);
  }
});

// ─── Validation Tests ─────────────────────────────────────────────────────────

test("validateAgentExecutionFinalizationStatus — accepts valid", () => {
  assert.ok(validateAgentExecutionFinalizationStatus("created"));
  assert.ok(validateAgentExecutionFinalizationStatus("dispatch_succeeded"));
  assert.ok(!validateAgentExecutionFinalizationStatus("invalid"));
});

test("validateAgentExecutionDispatchReadiness — accepts valid", () => {
  assert.ok(validateAgentExecutionDispatchReadiness("ready"));
  assert.ok(validateAgentExecutionDispatchReadiness("blocked"));
  assert.ok(!validateAgentExecutionDispatchReadiness("unknown"));
});

test("validateAgentExecutionDispatchGateStatus — accepts valid", () => {
  assert.ok(validateAgentExecutionDispatchGateStatus("allowed"));
  assert.ok(!validateAgentExecutionDispatchGateStatus("bad"));
});

test("validateAgentExecutionLockStatus — accepts valid", () => {
  assert.ok(validateAgentExecutionLockStatus("acquired"));
  assert.ok(!validateAgentExecutionLockStatus("nope"));
});

test("validateAgentExecutionIdempotencyStatus — accepts valid", () => {
  assert.ok(validateAgentExecutionIdempotencyStatus("completed"));
  assert.ok(!validateAgentExecutionIdempotencyStatus("xyz"));
});

test("validateAgentExecutionDispatchAttemptStatus — accepts valid", () => {
  assert.ok(validateAgentExecutionDispatchAttemptStatus("adapter_succeeded"));
  assert.ok(!validateAgentExecutionDispatchAttemptStatus("bad"));
});

test("validateAgentExecutionFinalConfirmationRequirement — accepts valid", () => {
  assert.ok(validateAgentExecutionFinalConfirmationRequirement("required_high_risk"));
  assert.ok(!validateAgentExecutionFinalConfirmationRequirement("bad"));
});

test("validateAgentExecutionFinalConfirmationStatus — accepts valid", () => {
  assert.ok(validateAgentExecutionFinalConfirmationStatus("confirmed"));
  assert.ok(!validateAgentExecutionFinalConfirmationStatus("bad"));
});

test("validateAgentExecutionSideEffectMode — accepts valid", () => {
  assert.ok(validateAgentExecutionSideEffectMode("dry_run"));
  assert.ok(validateAgentExecutionSideEffectMode("draft_only"));
  assert.ok(!validateAgentExecutionSideEffectMode("live"));
});

test("validateAgentExecutionDispatchEventType — accepts valid", () => {
  assert.ok(validateAgentExecutionDispatchEventType("finalization_created"));
  assert.ok(!validateAgentExecutionDispatchEventType("bad"));
});

test("validateAgentExecutionDispatchCheckType — accepts valid", () => {
  assert.ok(validateAgentExecutionDispatchCheckType("execution_mode_safe"));
  assert.ok(!validateAgentExecutionDispatchCheckType("bad"));
});

test("normalizeCreateAgentExecutionFinalizationInput — valid input normalizes", () => {
  const result = normalizeCreateAgentExecutionFinalizationInput({
    workspaceId: "ws1",
    executionRequestId: "req1",
    actionConversionId: null,
    createdBy: null,
  });
  assert.equal(result.workspaceId, "ws1");
  assert.equal(result.executionRequestId, "req1");
});

test("normalizeCreateAgentExecutionFinalizationInput — missing workspaceId rejects", () => {
  assert.throws(() => normalizeCreateAgentExecutionFinalizationInput({ workspaceId: "", executionRequestId: "req1" }), /workspaceId/);
});

test("normalizeCreateAgentExecutionFinalizationInput — missing executionRequestId rejects", () => {
  assert.throws(() => normalizeCreateAgentExecutionFinalizationInput({ workspaceId: "ws1", executionRequestId: "" }), /executionRequestId/);
});

test("normalizeConfirmAgentExecutionDispatchInput — rationale is required", () => {
  assert.throws(() => normalizeConfirmAgentExecutionDispatchInput({ workspaceId: "ws1", finalizationId: "fin1", rationale: "" }), /rationale/);
});

test("normalizeDispatchAgentExecutionInput — valid input", () => {
  const r = normalizeDispatchAgentExecutionInput({ workspaceId: "ws1", finalizationId: "fin1" });
  assert.equal(r.workspaceId, "ws1");
});

test("assertExecutionDispatchPayloadSerializable — accepts serializable", () => {
  assert.doesNotThrow(() => assertExecutionDispatchPayloadSerializable({ a: 1 }));
});

test("assertExecutionDispatchPayloadSerializable — rejects circular", () => {
  const obj = {};
  obj.self = obj;
  assert.throws(() => assertExecutionDispatchPayloadSerializable(obj));
});

test("redactExecutionDispatchPayload — redacts secret keys", () => {
  const result = redactExecutionDispatchPayload({ password: "secret123", name: "Alice", token: "abc" });
  assert.equal(result.password, "[REDACTED]");
  assert.equal(result.token, "[REDACTED]");
  assert.equal(result.name, "Alice");
});

test("dedupeDispatchStrings — removes duplicates", () => {
  const result = dedupeDispatchStrings(["a", "b", "a", "c", "b"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("createDispatchIdempotencyKey — is deterministic", () => {
  const key1 = createDispatchIdempotencyKey({ workspaceId: "ws1", executionRequestId: "req1", selectedAdapterKey: "adapter_a", executionMode: "dry_run" });
  const key2 = createDispatchIdempotencyKey({ workspaceId: "ws1", executionRequestId: "req1", selectedAdapterKey: "adapter_a", executionMode: "dry_run" });
  assert.equal(key1, key2);
});

test("createDispatchFingerprint — is deterministic", () => {
  const f1 = createDispatchFingerprint({ workspaceId: "ws1", executionRequestId: "req1" });
  const f2 = createDispatchFingerprint({ workspaceId: "ws1", executionRequestId: "req1" });
  assert.equal(f1, f2);
});

test("evaluateDispatchSideEffectMode — dry_run returns dry_run", () => {
  assert.equal(evaluateDispatchSideEffectMode({ executionMode: "dry_run" }), "dry_run");
});

test("evaluateDispatchSideEffectMode — draft_only returns draft_only", () => {
  assert.equal(evaluateDispatchSideEffectMode({ executionMode: "draft_only" }), "draft_only");
});

test("evaluateDispatchSideEffectMode — approval_required returns side_effect_potential", () => {
  assert.equal(evaluateDispatchSideEffectMode({ executionMode: "approval_required" }), "side_effect_potential");
});

test("evaluateDispatchSideEffectMode — live_execution returns side_effect_blocked", () => {
  assert.equal(evaluateDispatchSideEffectMode({ executionMode: "live_execution" }), "side_effect_blocked");
});

test("evaluateFinalConfirmationRequirement — high risk requires confirmation", () => {
  const r = evaluateFinalConfirmationRequirement({ riskLevel: "high", executionMode: "dry_run", sideEffectMode: "dry_run", approvalVerified: true });
  assert.equal(r.requirement, "required_high_risk");
});

test("evaluateFinalConfirmationRequirement — critical risk requires confirmation", () => {
  const r = evaluateFinalConfirmationRequirement({ riskLevel: "critical", executionMode: "dry_run", sideEffectMode: "dry_run", approvalVerified: true });
  assert.equal(r.requirement, "required_critical_risk");
});

test("evaluateFinalConfirmationRequirement — low risk dry_run not required", () => {
  const r = evaluateFinalConfirmationRequirement({ riskLevel: "low", executionMode: "dry_run", sideEffectMode: "dry_run", approvalVerified: true });
  assert.equal(r.requirement, "not_required");
});

test("calculateDispatchReadiness — all pass returns ready", () => {
  const r = calculateDispatchReadiness({
    executionRequestExists: true, workspaceMatches: true, executionRequestDispatchable: true,
    executionModeSafe: true, approvalReady: true, approvalBridgeSatisfied: true,
    conversionLinkageValid: true, adapterMappingExists: true, adapterEligible: true,
    sideEffectModeAllowed: true, finalConfirmationSatisfied: true,
    executionLockAvailable: true, idempotencyKeyValid: true, noPriorSuccessfulDispatch: true,
    payloadSafe: true, scopeKnown: true, riskLevelKnown: true,
  });
  assert.equal(r.readiness, "ready");
  assert.equal(r.blockingReasons.length, 0);
});

test("calculateDispatchReadiness — unsafe execution mode blocks", () => {
  const r = calculateDispatchReadiness({
    executionRequestExists: true, workspaceMatches: true, executionRequestDispatchable: true,
    executionModeSafe: false, approvalReady: true, approvalBridgeSatisfied: true,
    conversionLinkageValid: true, adapterMappingExists: true, adapterEligible: true,
    sideEffectModeAllowed: true, finalConfirmationSatisfied: true,
    executionLockAvailable: true, idempotencyKeyValid: true, noPriorSuccessfulDispatch: true,
    payloadSafe: true, scopeKnown: true, riskLevelKnown: true,
  });
  assert.equal(r.readiness, "blocked");
  assert.ok(r.blockingReasons.length > 0);
});

test("calculateDispatchReadiness — missing adapter mapping blocks", () => {
  const r = calculateDispatchReadiness({
    executionRequestExists: true, workspaceMatches: true, executionRequestDispatchable: true,
    executionModeSafe: true, approvalReady: true, approvalBridgeSatisfied: true,
    conversionLinkageValid: true, adapterMappingExists: false, adapterEligible: false,
    sideEffectModeAllowed: true, finalConfirmationSatisfied: true,
    executionLockAvailable: true, idempotencyKeyValid: true, noPriorSuccessfulDispatch: true,
    payloadSafe: true, scopeKnown: true, riskLevelKnown: true,
  });
  assert.equal(r.readiness, "blocked");
});

test("calculateDispatchReadiness — only unsatisfied confirmation returns requires_confirmation", () => {
  const r = calculateDispatchReadiness({
    executionRequestExists: true, workspaceMatches: true, executionRequestDispatchable: true,
    executionModeSafe: true, approvalReady: true, approvalBridgeSatisfied: true,
    conversionLinkageValid: true, adapterMappingExists: true, adapterEligible: true,
    sideEffectModeAllowed: true, finalConfirmationSatisfied: false,
    executionLockAvailable: true, idempotencyKeyValid: true, noPriorSuccessfulDispatch: true,
    payloadSafe: true, scopeKnown: true, riskLevelKnown: true,
  });
  assert.equal(r.readiness, "requires_confirmation");
});

// ─── Migration Tests ──────────────────────────────────────────────────────────

test("migration creates agent_execution_finalizations table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_finalizations"));
});

test("migration creates agent_execution_dispatch_gates table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_dispatch_gates"));
});

test("migration creates agent_execution_dispatch_locks table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_dispatch_locks"));
});

test("migration creates agent_execution_dispatch_idempotency table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_dispatch_idempotency"));
});

test("migration creates agent_execution_dispatch_attempts table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_dispatch_attempts"));
});

test("migration creates agent_execution_final_confirmations table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_final_confirmations"));
});

test("migration creates agent_execution_dispatch_events table", () => {
  assert.ok(migrationFile.includes("create table if not exists public.agent_execution_dispatch_events"));
});

test("migration enables RLS on all dispatch tables", () => {
  assert.ok(migrationFile.includes("alter table public.agent_execution_finalizations enable row level security"));
  assert.ok(migrationFile.includes("alter table public.agent_execution_dispatch_gates enable row level security"));
  assert.ok(migrationFile.includes("alter table public.agent_execution_dispatch_locks enable row level security"));
  assert.ok(migrationFile.includes("alter table public.agent_execution_dispatch_idempotency enable row level security"));
  assert.ok(migrationFile.includes("alter table public.agent_execution_dispatch_attempts enable row level security"));
  assert.ok(migrationFile.includes("alter table public.agent_execution_final_confirmations enable row level security"));
  assert.ok(migrationFile.includes("alter table public.agent_execution_dispatch_events enable row level security"));
});

test("migration creates indexes", () => {
  assert.ok(migrationFile.includes("create index if not exists agent_execution_finalizations_workspace_idx"));
  assert.ok(migrationFile.includes("create index if not exists agent_execution_dispatch_gates_workspace_idx"));
});

test("migration references agent_execution_requests", () => {
  assert.ok(migrationFile.includes("references public.agent_execution_requests(id)"));
});

test("migration references agent_tool_adapter_executions", () => {
  assert.ok(migrationFile.includes("references public.agent_tool_adapter_executions(id)"));
});

test("migration references agent_execution_results", () => {
  assert.ok(migrationFile.includes("references public.agent_execution_results(id)"));
});

test("migration references agent_action_conversions", () => {
  assert.ok(migrationFile.includes("references public.agent_action_conversions(id)"));
});

test("migration references workspaces", () => {
  assert.ok(migrationFile.includes("references public.workspaces(id)"));
});

// ─── Database Contract Tests ──────────────────────────────────────────────────

test("contract includes AgentExecutionFinalizationRow", () => {
  assert.ok(contractFile.includes("AgentExecutionFinalizationRow"));
});

test("contract includes AgentExecutionDispatchGateRow", () => {
  assert.ok(contractFile.includes("AgentExecutionDispatchGateRow"));
});

test("contract includes AgentExecutionDispatchLockRow", () => {
  assert.ok(contractFile.includes("AgentExecutionDispatchLockRow"));
});

test("contract includes AgentExecutionDispatchIdempotencyRow", () => {
  assert.ok(contractFile.includes("AgentExecutionDispatchIdempotencyRow"));
});

test("contract includes AgentExecutionDispatchAttemptRow", () => {
  assert.ok(contractFile.includes("AgentExecutionDispatchAttemptRow"));
});

test("contract includes AgentExecutionFinalConfirmationRow", () => {
  assert.ok(contractFile.includes("AgentExecutionFinalConfirmationRow"));
});

test("contract includes AgentExecutionDispatchEventRow", () => {
  assert.ok(contractFile.includes("AgentExecutionDispatchEventRow"));
});

test("contract includes dispatch column arrays", () => {
  assert.ok(contractFile.includes("AGENT_EXECUTION_FINALIZATION_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_DISPATCH_GATE_COLUMNS"));
  assert.ok(contractFile.includes("AGENT_EXECUTION_DISPATCH_LOCK_COLUMNS"));
});

test("contract version string updated", () => {
  assert.ok(contractFile.includes("controlled-execution-finalization-adapter-dispatch-gate"));
});

// ─── Registry Tests ───────────────────────────────────────────────────────────

test("registry exports createAgentExecutionFinalization", () => {
  assert.ok(registryFile.includes("export async function createAgentExecutionFinalization"));
});

test("registry exports getAgentExecutionFinalizationById", () => {
  assert.ok(registryFile.includes("export async function getAgentExecutionFinalizationById"));
});

test("registry exports getAgentExecutionFinalizationByExecutionRequestId", () => {
  assert.ok(registryFile.includes("export async function getAgentExecutionFinalizationByExecutionRequestId"));
});

test("registry exports listAgentExecutionFinalizations", () => {
  assert.ok(registryFile.includes("export async function listAgentExecutionFinalizations"));
});

test("registry exports updateAgentExecutionFinalizationStatus", () => {
  assert.ok(registryFile.includes("export async function updateAgentExecutionFinalizationStatus"));
});

test("registry exports createAgentExecutionDispatchGate", () => {
  assert.ok(registryFile.includes("export async function createAgentExecutionDispatchGate"));
});

test("registry exports acquireAgentExecutionDispatchLock", () => {
  assert.ok(registryFile.includes("export async function acquireAgentExecutionDispatchLock"));
});

test("registry exports releaseAgentExecutionDispatchLock", () => {
  assert.ok(registryFile.includes("export async function releaseAgentExecutionDispatchLock"));
});

test("registry exports createOrGetAgentExecutionDispatchIdempotency", () => {
  assert.ok(registryFile.includes("export async function createOrGetAgentExecutionDispatchIdempotency"));
});

test("registry exports createAgentExecutionDispatchAttempt", () => {
  assert.ok(registryFile.includes("export async function createAgentExecutionDispatchAttempt"));
});

test("registry exports updateAgentExecutionDispatchAttemptStatus", () => {
  assert.ok(registryFile.includes("export async function updateAgentExecutionDispatchAttemptStatus"));
});

test("registry exports createAgentExecutionFinalConfirmation", () => {
  assert.ok(registryFile.includes("export async function createAgentExecutionFinalConfirmation"));
});

test("registry exports confirmAgentExecutionFinalConfirmation", () => {
  assert.ok(registryFile.includes("export async function confirmAgentExecutionFinalConfirmation"));
});

test("registry exports recordAgentExecutionDispatchEvent", () => {
  assert.ok(registryFile.includes("export async function recordAgentExecutionDispatchEvent"));
});

test("registry exports listAgentExecutionDispatchEvents", () => {
  assert.ok(registryFile.includes("export async function listAgentExecutionDispatchEvents"));
});

test("registry does not hard-delete records", () => {
  assert.ok(!registryFile.includes(".delete("));
});

test("events are append-only", () => {
  assert.ok(registryFile.includes("eventStore.set(key, [...existing, record])"));
});

test("dispatch attempts are append-only", () => {
  assert.ok(registryFile.includes("attemptStore.set(input.finalizationId, [...existingAttempts, record])"));
});

test("locks are released not deleted", () => {
  assert.ok(registryFile.includes("status: \"released\""));
  assert.ok(!registryFile.includes("lockStore.delete("));
});

test("idempotency records are reused not duplicated", () => {
  assert.ok(registryFile.includes("if (existing) return existing"));
});

// ─── Registry Functional Tests ────────────────────────────────────────────────

test("createAgentExecutionFinalization — creates record with created status", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  assert.equal(fin.status, "created");
  assert.equal(fin.readiness, "not_ready");
  assert.equal(fin.workspaceId, "ws1");
  assert.equal(fin.executionRequestId, "req1");
});

test("getAgentExecutionFinalizationById — returns record by id", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const found = await getAgentExecutionFinalizationById("ws1", fin.id);
  assert.ok(found);
  assert.equal(found.id, fin.id);
});

test("getAgentExecutionFinalizationById — returns null for wrong workspace", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const found = await getAgentExecutionFinalizationById("ws2", fin.id);
  assert.equal(found, null);
});

test("getAgentExecutionFinalizationByExecutionRequestId — finds by executionRequestId", async () => {
  _clearDispatchStores();
  await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req999" });
  const found = await getAgentExecutionFinalizationByExecutionRequestId("ws1", "req999");
  assert.ok(found);
});

test("listAgentExecutionFinalizations — filters by status", async () => {
  _clearDispatchStores();
  await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const results = await listAgentExecutionFinalizations("ws1", { status: "created" });
  assert.ok(results.length >= 1);
});

test("updateAgentExecutionFinalizationStatus — updates status", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const updated = await updateAgentExecutionFinalizationStatus({ workspaceId: "ws1", finalizationId: fin.id, status: "readiness_passed", readiness: "ready" });
  assert.equal(updated.status, "readiness_passed");
  assert.equal(updated.readiness, "ready");
});

test("acquireAgentExecutionDispatchLock — acquires lock", async () => {
  _clearDispatchStores();
  const lock = await acquireAgentExecutionDispatchLock({ workspaceId: "ws1", executionRequestId: "req1", lockKey: "ws1:req1" });
  assert.equal(lock.status, "acquired");
});

test("acquireAgentExecutionDispatchLock — fails if already acquired", async () => {
  _clearDispatchStores();
  await acquireAgentExecutionDispatchLock({ workspaceId: "ws1", executionRequestId: "req1", lockKey: "ws1:reqdup" });
  await assert.rejects(
    () => acquireAgentExecutionDispatchLock({ workspaceId: "ws1", executionRequestId: "req1", lockKey: "ws1:reqdup" }),
    /Lock already acquired/,
  );
});

test("releaseAgentExecutionDispatchLock — releases lock", async () => {
  _clearDispatchStores();
  const lock = await acquireAgentExecutionDispatchLock({ workspaceId: "ws1", executionRequestId: "req1", lockKey: "ws1:reqrel" });
  const released = await releaseAgentExecutionDispatchLock({ workspaceId: "ws1", lockId: lock.id, releaseReason: "test" });
  assert.equal(released.status, "released");
});

test("createOrGetAgentExecutionDispatchIdempotency — reuses existing record", async () => {
  _clearDispatchStores();
  const r1 = await createOrGetAgentExecutionDispatchIdempotency({ workspaceId: "ws1", executionRequestId: "req1", idempotencyKey: "idem1", idempotencyFingerprint: "fp1" });
  const r2 = await createOrGetAgentExecutionDispatchIdempotency({ workspaceId: "ws1", executionRequestId: "req1", idempotencyKey: "idem1", idempotencyFingerprint: "fp1" });
  assert.equal(r1.id, r2.id);
});

test("createAgentExecutionDispatchAttempt — creates attempt", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const attempt = await createAgentExecutionDispatchAttempt({ workspaceId: "ws1", finalizationId: fin.id, executionRequestId: "req1", executionMode: "dry_run" });
  assert.equal(attempt.status, "created");
  assert.equal(attempt.executionMode, "dry_run");
});

test("recordAgentExecutionDispatchEvent — appends event", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  await recordAgentExecutionDispatchEvent({ workspaceId: "ws1", finalizationId: fin.id, executionRequestId: "req1", eventType: "finalization_created" });
  const events = await listAgentExecutionDispatchEvents({ workspaceId: "ws1", finalizationId: fin.id });
  assert.ok(events.length >= 1);
  assert.ok(events.some((e) => e.eventType === "finalization_created"));
});

test("createAgentExecutionFinalConfirmation — creates confirmation", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const conf = await createAgentExecutionFinalConfirmation({
    workspaceId: "ws1", finalizationId: fin.id, executionRequestId: "req1",
    requirement: "required_high_risk", status: "required",
  });
  assert.equal(conf.status, "required");
  assert.equal(conf.requirement, "required_high_risk");
});

test("confirmAgentExecutionFinalConfirmation — confirms", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "req1" });
  const conf = await createAgentExecutionFinalConfirmation({
    workspaceId: "ws1", finalizationId: fin.id, executionRequestId: "req1",
    requirement: "required_high_risk", status: "required",
  });
  const confirmed = await confirmAgentExecutionFinalConfirmation({ workspaceId: "ws1", confirmationId: conf.id, rationale: "All checks passed." });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.rationale, "All checks passed.");
});

// ─── Service Tests ────────────────────────────────────────────────────────────

test("service exports createFinalizationFromExecutionRequest", () => {
  assert.ok(serviceFile.includes("export async function createFinalizationFromExecutionRequest"));
});

test("service exports runExecutionDispatchReadiness", () => {
  assert.ok(serviceFile.includes("export async function runExecutionDispatchReadiness"));
});

test("service exports createExecutionDispatchGate", () => {
  assert.ok(serviceFile.includes("export async function createExecutionDispatchGate"));
});

test("service exports recordFinalDispatchConfirmation", () => {
  assert.ok(serviceFile.includes("export async function recordFinalDispatchConfirmation"));
});

test("service exports dispatchExecutionToAdapter", () => {
  assert.ok(serviceFile.includes("export async function dispatchExecutionToAdapter"));
});

test("service exports cancelExecutionDispatch", () => {
  assert.ok(serviceFile.includes("export async function cancelExecutionDispatch"));
});

test("service exports buildExecutionDispatchSummary", () => {
  assert.ok(serviceFile.includes("export async function buildExecutionDispatchSummary"));
});

test("service exports getDispatchAdapterMapping", () => {
  assert.ok(serviceFile.includes("export function getDispatchAdapterMapping"));
});

test("getDispatchAdapterMapping — returns mapping", () => {
  const mapping = getDispatchAdapterMapping({ executionRequestId: "req1", toolKey: "draft_email" });
  assert.ok(mapping.selectedAdapterKey);
  assert.equal(mapping.executionMode, "draft_only");
});

test("getDispatchAdapterMapping — dry_run tool", () => {
  const mapping = getDispatchAdapterMapping({ executionRequestId: "req1", toolKey: "dry_run_analysis" });
  assert.equal(mapping.executionMode, "dry_run");
  assert.equal(mapping.sideEffectMode, "dry_run");
});

test("service does not call LLM providers", () => {
  assert.ok(!serviceFile.includes("openai"));
  assert.ok(!serviceFile.includes("anthropic"));
  assert.ok(!serviceFile.includes("gemini"));
});

test("service does not call external APIs directly", () => {
  assert.ok(!serviceFile.includes("fetch(\"http"));
  assert.ok(!serviceFile.includes("fetch(\"https"));
});

test("service does not send communications", () => {
  assert.ok(!serviceFile.includes("sendEmail"));
  assert.ok(!serviceFile.includes("sendSlack"));
  assert.ok(!serviceFile.includes("gmail"));
});

test("service only dispatches dry_run/draft_only adapters", () => {
  assert.ok(serviceFile.includes('SAFE_EXECUTION_MODES.has(fin.executionMode)'));
  assert.ok(serviceFile.includes('"dry_run"'));
  assert.ok(serviceFile.includes('"draft_only"'));
});

test("service does not mutate projects", () => {
  assert.ok(!serviceFile.includes("updateProject"));
  assert.ok(!serviceFile.includes("mutateProject"));
});

test("buildExecutionDispatchSummary — returns summary", async () => {
  _clearDispatchStores();
  await createAgentExecutionFinalization({ workspaceId: "ws99", executionRequestId: "req1" });
  await createAgentExecutionFinalization({ workspaceId: "ws99", executionRequestId: "req2" });
  const summary = await buildExecutionDispatchSummary({ workspaceId: "ws99" });
  assert.equal(summary.totalFinalizations, 2);
  assert.equal(summary.created, 2);
});

test("cancelExecutionDispatch — cancels finalization", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "reqcancel" });
  const cancelled = await cancelExecutionDispatch({ workspaceId: "ws1", finalizationId: fin.id, message: "test cancel" });
  assert.equal(cancelled.status, "cancelled");
});

test("cancelExecutionDispatch — cannot cancel terminal status", async () => {
  _clearDispatchStores();
  const fin = await createAgentExecutionFinalization({ workspaceId: "ws1", executionRequestId: "reqterm" });
  await updateAgentExecutionFinalizationStatus({ workspaceId: "ws1", finalizationId: fin.id, status: "dispatch_succeeded" });
  await assert.rejects(
    () => cancelExecutionDispatch({ workspaceId: "ws1", finalizationId: fin.id }),
    /terminal status/,
  );
});

// ─── API Route Tests ──────────────────────────────────────────────────────────

test("finalizations POST route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/route.ts")));
});

test("finalizations GET route exists", () => {
  const f = readFileSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/route.ts"), "utf8");
  assert.ok(f.includes("export async function GET"));
  assert.ok(f.includes("export async function POST"));
});

test("finalization detail route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/route.ts")));
});

test("from-execution-request route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/from-execution-request/route.ts")));
});

test("readiness route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/readiness/route.ts")));
});

test("gate route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/gate/route.ts")));
});

test("confirm route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/confirm/route.ts")));
});

test("dispatch route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/dispatch/route.ts")));
});

test("cancel route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/cancel/route.ts")));
});

test("events route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/events/route.ts")));
});

test("summary route exists", () => {
  assert.ok(existsSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/summary/route.ts")));
});

test("route files do not call LLM providers", () => {
  const dispatchRouteFile = readFileSync(resolve(ROOT, "src/app/api/agents/execution/dispatch/finalizations/[finalizationId]/dispatch/route.ts"), "utf8");
  assert.ok(!dispatchRouteFile.includes("openai"));
  assert.ok(!dispatchRouteFile.includes("anthropic"));
});

// ─── Observability Tests ──────────────────────────────────────────────────────

test("observability types include execution dispatch event types", () => {
  assert.ok(obsFile.includes("execution_finalization_created"));
  assert.ok(obsFile.includes("execution_dispatch_readiness_passed"));
  assert.ok(obsFile.includes("execution_dispatch_completed"));
  assert.ok(obsFile.includes("execution_dispatch_cancelled"));
});

test("observability source includes agent_controlled_execution_finalization_adapter_dispatch_gate", () => {
  assert.ok(obsFile.includes("agent_controlled_execution_finalization_adapter_dispatch_gate"));
});

test("dispatch service records audit events via tryAuditEvent", () => {
  assert.ok(serviceFile.includes("tryAuditEvent"));
  assert.ok(serviceFile.includes("execution_finalization_created"));
});

// ─── Terminology Tests ────────────────────────────────────────────────────────

const BAD_TERMS = ["Fucker", "fucker", "fuckers", "FUCKER"];

test("no internal informal sprint nickname in types file", () => {
  for (const term of BAD_TERMS) {
    assert.ok(!typesFile.includes(term), `Found banned term '${term}' in types file`);
  }
});

test("no internal informal sprint nickname in service file", () => {
  for (const term of BAD_TERMS) {
    assert.ok(!serviceFile.includes(term), `Found banned term '${term}' in service file`);
  }
});

test("no internal informal sprint nickname in migration file", () => {
  for (const term of BAD_TERMS) {
    assert.ok(!migrationFile.includes(term), `Found banned term '${term}' in migration file`);
  }
});

test("no internal informal sprint nickname in docs file", () => {
  if (!docsFile) return;
  for (const term of BAD_TERMS) {
    assert.ok(!docsFile.includes(term), `Found banned term '${term}' in docs file`);
  }
});

// ─── Index Exports Tests ──────────────────────────────────────────────────────

test("index exports dispatch types", () => {
  assert.ok(indexFile.includes("AgentExecutionFinalizationStatus"));
  assert.ok(indexFile.includes("AgentExecutionDispatchReadiness"));
  assert.ok(indexFile.includes("AgentExecutionDispatchGateStatus"));
});

test("index exports dispatch validation helpers", () => {
  assert.ok(indexFile.includes("validateAgentExecutionFinalizationStatus"));
  assert.ok(indexFile.includes("createDispatchIdempotencyKey"));
  assert.ok(indexFile.includes("calculateDispatchReadiness"));
});

test("index exports dispatch registry functions", () => {
  assert.ok(indexFile.includes("createAgentExecutionFinalization"));
  assert.ok(indexFile.includes("acquireAgentExecutionDispatchLock"));
  assert.ok(indexFile.includes("recordAgentExecutionDispatchEvent"));
});

test("index exports dispatch service functions", () => {
  assert.ok(indexFile.includes("createFinalizationFromExecutionRequest"));
  assert.ok(indexFile.includes("dispatchExecutionToAdapter"));
  assert.ok(indexFile.includes("buildExecutionDispatchSummary"));
});
