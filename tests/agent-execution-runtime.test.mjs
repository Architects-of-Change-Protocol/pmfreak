import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Load source files ────────────────────────────────────────────────────────

const execTypes = fs.readFileSync("src/lib/agents/agent-execution-types.ts", "utf8");
const execValidation = fs.readFileSync("src/lib/agents/agent-execution-validation.ts", "utf8");
const execStateMachine = fs.readFileSync("src/lib/agents/agent-execution-state-machine.ts", "utf8");
const execRegistry = fs.readFileSync("src/lib/agents/agent-execution-registry.ts", "utf8");
const execService = fs.readFileSync("src/lib/agents/agent-execution-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260730000000_agent_execution_request_runtime.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/agents/index.ts", "utf8");

// ─── Pure module imports ──────────────────────────────────────────────────────

const {
  validateAgentExecutionMode,
  validateAgentExecutionState,
  validateAgentExecutionRiskLevel,
  validateAgentExecutionScopeType,
  validateAgentExecutionSourceType,
  validateAgentExecutionEventType,
  validateAgentExecutionPreflightStatus,
  assertExecutionPayloadSerializable,
  redactExecutionPayload,
  normalizeCreateAgentExecutionRequestInput,
} = await import("../src/lib/agents/agent-execution-validation.ts");

const {
  canTransitionAgentExecutionState,
  getAllowedAgentExecutionTransitions,
  assertAgentExecutionTransition,
} = await import("../src/lib/agents/agent-execution-state-machine.ts");

// ─── Type definitions ─────────────────────────────────────────────────────────

test("AgentExecutionMode contains all required values", () => {
  for (const v of ["dry_run", "draft_only", "approval_required", "approved_execution"]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing mode: ${v}`);
  }
});

test("AgentExecutionState contains all required values", () => {
  for (const v of [
    "draft", "pending_preflight", "preflight_failed", "blocked",
    "pending_approval", "approved", "ready_for_execution", "executing",
    "completed", "failed", "cancelled", "expired",
  ]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing state: ${v}`);
  }
});

test("AgentExecutionRiskLevel contains all required values", () => {
  for (const v of ["low", "medium", "high", "critical"]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing risk level: ${v}`);
  }
});

test("AgentExecutionScopeType contains all required values", () => {
  for (const v of [
    "workspace", "portfolio", "project", "pm", "agent",
    "tool_request", "approval_request", "memory_record",
  ]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing scope type: ${v}`);
  }
});

test("AgentExecutionSourceType contains all required values", () => {
  for (const v of ["api", "agent", "scheduler", "webhook", "system", "user"]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing source type: ${v}`);
  }
});

test("AgentExecutionEventType contains all required values", () => {
  for (const v of [
    "execution_request_created", "execution_request_updated",
    "execution_preflight_started", "execution_preflight_passed", "execution_preflight_failed",
    "execution_blocked", "execution_pending_approval", "execution_approved",
    "execution_ready", "execution_dry_run_completed", "execution_draft_completed",
    "execution_cancelled", "execution_expired", "execution_failed", "execution_state_transition",
  ]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing event type: ${v}`);
  }
});

test("AgentExecutionPreflightStatus contains all required values", () => {
  for (const v of ["not_started", "in_progress", "passed", "failed", "skipped"]) {
    assert.ok(execTypes.includes(`"${v}"`), `Missing preflight status: ${v}`);
  }
});

// ─── Validation ───────────────────────────────────────────────────────────────

test("valid execution modes pass", () => {
  for (const v of ["dry_run", "draft_only", "approval_required", "approved_execution"]) {
    assert.ok(validateAgentExecutionMode(v), `Expected ${v} to be valid`);
  }
});

test("invalid execution mode fails", () => {
  assert.equal(validateAgentExecutionMode("invalid"), false);
  assert.equal(validateAgentExecutionMode(""), false);
});

test("valid execution states pass", () => {
  for (const v of ["draft", "pending_preflight", "completed", "failed", "cancelled"]) {
    assert.ok(validateAgentExecutionState(v), `Expected ${v} to be valid`);
  }
});

test("invalid execution state fails", () => {
  assert.equal(validateAgentExecutionState("running"), false);
});

test("valid risk levels pass", () => {
  for (const v of ["low", "medium", "high", "critical"]) {
    assert.ok(validateAgentExecutionRiskLevel(v));
  }
});

test("invalid risk level fails", () => {
  assert.equal(validateAgentExecutionRiskLevel("extreme"), false);
});

test("valid scope types pass", () => {
  assert.ok(validateAgentExecutionScopeType("workspace"));
  assert.ok(validateAgentExecutionScopeType("project"));
});

test("invalid scope type fails", () => {
  assert.equal(validateAgentExecutionScopeType("unknown"), false);
});

test("valid source types pass", () => {
  assert.ok(validateAgentExecutionSourceType("api"));
  assert.ok(validateAgentExecutionSourceType("agent"));
});

test("invalid source type fails", () => {
  assert.equal(validateAgentExecutionSourceType("jira"), false);
});

test("valid event types pass", () => {
  assert.ok(validateAgentExecutionEventType("execution_request_created"));
  assert.ok(validateAgentExecutionEventType("execution_cancelled"));
});

test("invalid event type fails", () => {
  assert.equal(validateAgentExecutionEventType("unknown_event"), false);
});

test("valid preflight statuses pass", () => {
  for (const v of ["not_started", "in_progress", "passed", "failed", "skipped"]) {
    assert.ok(validateAgentExecutionPreflightStatus(v));
  }
});

test("invalid preflight status fails", () => {
  assert.equal(validateAgentExecutionPreflightStatus("pending"), false);
});

// ─── Payload safety ───────────────────────────────────────────────────────────

test("payload must be JSON serializable", () => {
  const circular = {};
  circular["self"] = circular;
  assert.throws(() => assertExecutionPayloadSerializable(circular), /serializable/i);
});

test("null payload is serializable", () => {
  assert.doesNotThrow(() => assertExecutionPayloadSerializable(null));
});

test("valid payload is serializable", () => {
  assert.doesNotThrow(() => assertExecutionPayloadSerializable({ key: "value", count: 1 }));
});

test("payload over 50KB is rejected", () => {
  const largeObj = { data: "x".repeat(52 * 1024) };
  assert.throws(() => assertExecutionPayloadSerializable(largeObj), /maximum size/i);
});

// ─── Payload redaction ────────────────────────────────────────────────────────

test("secret-like payload keys are redacted", () => {
  const result = redactExecutionPayload({
    title: "hello",
    password: "hunter2",
    token: "abc123",
    api_key: "secret",
    normalField: "ok",
  });
  assert.equal(result?.password, "[REDACTED]");
  assert.equal(result?.token, "[REDACTED]");
  assert.equal(result?.api_key, "[REDACTED]");
  assert.equal(result?.normalField, "ok");
  assert.equal(result?.title, "hello");
});

test("redacted payload does not expose private_key", () => {
  const result = redactExecutionPayload({ private_key: "supersecret" });
  assert.equal(result?.private_key, "[REDACTED]");
});

test("redacted payload does not expose access_token", () => {
  const result = redactExecutionPayload({ access_token: "tok_xyz" });
  assert.equal(result?.access_token, "[REDACTED]");
});

test("redacted payload does not expose client_secret", () => {
  const result = redactExecutionPayload({ client_secret: "cs_xyz" });
  assert.equal(result?.client_secret, "[REDACTED]");
});

test("null payload returns null from redact", () => {
  assert.equal(redactExecutionPayload(null), null);
});

// ─── Normalization ────────────────────────────────────────────────────────────

test("normalizeCreateAgentExecutionRequestInput defaults riskLevel to medium", () => {
  const result = normalizeCreateAgentExecutionRequestInput({
    workspaceId: "ws_1",
    toolKey: "send_email",
    executionMode: "dry_run",
    scopeType: "workspace",
    sourceType: "api",
    title: "Test execution",
  });
  assert.equal(result.riskLevel, "medium");
});

test("normalizeCreateAgentExecutionRequestInput trims title", () => {
  const result = normalizeCreateAgentExecutionRequestInput({
    workspaceId: "ws_1",
    toolKey: "send_email",
    executionMode: "dry_run",
    scopeType: "workspace",
    sourceType: "api",
    title: "  My title  ",
  });
  assert.equal(result.title, "My title");
});

test("normalizeCreateAgentExecutionRequestInput deduplicates memoryIds", () => {
  const result = normalizeCreateAgentExecutionRequestInput({
    workspaceId: "ws_1",
    toolKey: "send_email",
    executionMode: "dry_run",
    scopeType: "workspace",
    sourceType: "api",
    title: "t",
    memoryIds: ["m1", "m1", "m2"],
  });
  assert.deepEqual(result.memoryIds, ["m1", "m2"]);
});

test("normalizeCreateAgentExecutionRequestInput deduplicates evidenceRefs", () => {
  const result = normalizeCreateAgentExecutionRequestInput({
    workspaceId: "ws_1",
    toolKey: "send_email",
    executionMode: "dry_run",
    scopeType: "workspace",
    sourceType: "api",
    title: "t",
    evidenceRefs: ["ref_a", "ref_a", "ref_b"],
  });
  assert.deepEqual(result.evidenceRefs, ["ref_a", "ref_b"]);
});

test("normalizeCreateAgentExecutionRequestInput rejects past expiresAt", () => {
  assert.throws(
    () => normalizeCreateAgentExecutionRequestInput({
      workspaceId: "ws_1",
      toolKey: "send_email",
      executionMode: "dry_run",
      scopeType: "workspace",
      sourceType: "api",
      title: "t",
      expiresAt: "2000-01-01T00:00:00.000Z",
    }),
    /future/i,
  );
});

test("normalizeCreateAgentExecutionRequestInput rejects invalid mode", () => {
  assert.throws(
    () => normalizeCreateAgentExecutionRequestInput({
      workspaceId: "ws_1",
      toolKey: "send_email",
      executionMode: "invalid_mode",
      scopeType: "workspace",
      sourceType: "api",
      title: "t",
    }),
    /execution mode/i,
  );
});

// ─── State machine ────────────────────────────────────────────────────────────

test("draft can transition to pending_preflight", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "draft", to: "pending_preflight" }));
});

test("draft can transition to cancelled", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "draft", to: "cancelled" }));
});

test("draft cannot transition to completed", () => {
  assert.equal(canTransitionAgentExecutionState({ from: "draft", to: "completed" }), false);
});

test("pending_preflight can transition to ready_for_execution", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "pending_preflight", to: "ready_for_execution" }));
});

test("pending_preflight can transition to pending_approval", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "pending_preflight", to: "pending_approval" }));
});

test("pending_preflight can transition to blocked", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "pending_preflight", to: "blocked" }));
});

test("pending_approval can transition to approved", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "pending_approval", to: "approved" }));
});

test("approved can transition to ready_for_execution", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "approved", to: "ready_for_execution" }));
});

test("ready_for_execution can transition to completed", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "ready_for_execution", to: "completed" }));
});

test("ready_for_execution can transition to failed", () => {
  assert.ok(canTransitionAgentExecutionState({ from: "ready_for_execution", to: "failed" }));
});

test("completed is terminal - cannot transition", () => {
  assert.equal(canTransitionAgentExecutionState({ from: "completed", to: "cancelled" }), false);
  assert.equal(getAllowedAgentExecutionTransitions("completed").length, 0);
});

test("failed is terminal - cannot transition", () => {
  assert.equal(canTransitionAgentExecutionState({ from: "failed", to: "cancelled" }), false);
});

test("cancelled is terminal - cannot transition", () => {
  assert.equal(canTransitionAgentExecutionState({ from: "cancelled", to: "draft" }), false);
});

test("expired is terminal - cannot transition", () => {
  assert.equal(canTransitionAgentExecutionState({ from: "expired", to: "draft" }), false);
});

test("assertAgentExecutionTransition throws on invalid transition", () => {
  assert.throws(
    () => assertAgentExecutionTransition({ from: "completed", to: "draft" }),
    /invalid/i,
  );
});

test("assertAgentExecutionTransition passes on valid transition", () => {
  assert.doesNotThrow(() => assertAgentExecutionTransition({ from: "draft", to: "pending_preflight" }));
});

test("getAllowedAgentExecutionTransitions returns correct transitions", () => {
  const transitions = getAllowedAgentExecutionTransitions("draft");
  assert.ok(transitions.includes("pending_preflight"));
  assert.ok(transitions.includes("cancelled"));
});

// ─── Migration structure ──────────────────────────────────────────────────────

test("migration creates agent_execution_requests table", () => {
  assert.ok(migration.includes("create table if not exists public.agent_execution_requests"));
});

test("migration creates agent_execution_events table", () => {
  assert.ok(migration.includes("create table if not exists public.agent_execution_events"));
});

test("migration enables RLS on both tables", () => {
  assert.ok(migration.includes("alter table public.agent_execution_requests enable row level security"));
  assert.ok(migration.includes("alter table public.agent_execution_events enable row level security"));
});

test("migration includes workspace member read policy", () => {
  assert.ok(migration.includes("workspace_members_read_execution_requests"));
});

test("migration includes workspace member insert policy", () => {
  assert.ok(migration.includes("workspace_members_insert_execution_requests"));
});

test("migration includes workspace admin update policy", () => {
  assert.ok(migration.includes("workspace_admins_update_execution_requests"));
});

test("migration includes execution_state column", () => {
  assert.ok(migration.includes("execution_state text not null"));
});

test("migration includes risk_level column", () => {
  assert.ok(migration.includes("risk_level text not null"));
});

test("migration includes preflight_status column", () => {
  assert.ok(migration.includes("preflight_status text not null"));
});

test("migration includes indexes", () => {
  assert.ok(migration.includes("agent_execution_requests_workspace_idx"));
  assert.ok(migration.includes("agent_execution_requests_state_idx"));
});

// ─── Database contract ────────────────────────────────────────────────────────

test("contract declares AgentExecutionRequestRow", () => {
  assert.ok(contract.includes("AgentExecutionRequestRow"));
});

test("contract declares AgentExecutionEventRow", () => {
  assert.ok(contract.includes("AgentExecutionEventRow"));
});

test("contract declares AGENT_EXECUTION_REQUEST_COLUMNS", () => {
  assert.ok(contract.includes("AGENT_EXECUTION_REQUEST_COLUMNS"));
});

test("contract declares AGENT_EXECUTION_EVENT_COLUMNS", () => {
  assert.ok(contract.includes("AGENT_EXECUTION_EVENT_COLUMNS"));
});

test("contract version includes execution runtime", () => {
  assert.ok(contract.includes("agent-execution-request-runtime"));
});

// ─── Registry structure ───────────────────────────────────────────────────────

test("registry exports createAgentExecutionRequest", () => {
  assert.ok(execRegistry.includes("createAgentExecutionRequest"));
});

test("registry exports getAgentExecutionRequestById", () => {
  assert.ok(execRegistry.includes("getAgentExecutionRequestById"));
});

test("registry exports listAgentExecutionRequests", () => {
  assert.ok(execRegistry.includes("listAgentExecutionRequests"));
});

test("registry exports updateAgentExecutionRequestState", () => {
  assert.ok(execRegistry.includes("updateAgentExecutionRequestState"));
});

test("registry exports recordAgentExecutionEvent", () => {
  assert.ok(execRegistry.includes("recordAgentExecutionEvent"));
});

test("registry exports listAgentExecutionEvents", () => {
  assert.ok(execRegistry.includes("listAgentExecutionEvents"));
});

test("registry maps input_payload_json to camelCase", () => {
  assert.ok(execRegistry.includes("input_payload_json"));
  assert.ok(execRegistry.includes("inputPayload"));
});

test("registry maps memory_ids_json to array", () => {
  assert.ok(execRegistry.includes("memory_ids_json"));
});

// ─── Service structure ────────────────────────────────────────────────────────

test("service exports createGovernedAgentExecutionRequest", () => {
  assert.ok(execService.includes("createGovernedAgentExecutionRequest"));
});

test("service exports runAgentExecutionPreflight", () => {
  assert.ok(execService.includes("runAgentExecutionPreflight"));
});

test("service exports approveAgentExecutionRequest", () => {
  assert.ok(execService.includes("approveAgentExecutionRequest"));
});

test("service exports completeDryRunExecution", () => {
  assert.ok(execService.includes("completeDryRunExecution"));
});

test("service exports completeDraftOnlyExecution", () => {
  assert.ok(execService.includes("completeDraftOnlyExecution"));
});

test("service exports cancelAgentExecutionRequest", () => {
  assert.ok(execService.includes("cancelAgentExecutionRequest"));
});

test("service exports expireAgentExecutionRequest", () => {
  assert.ok(execService.includes("expireAgentExecutionRequest"));
});

test("service exports failAgentExecution", () => {
  assert.ok(execService.includes("failAgentExecution"));
});

test("service wraps observability calls in try/catch", () => {
  assert.ok(execService.includes("try") && execService.includes("catch"));
});

test("service does not call LLM providers", () => {
  assert.ok(!execService.includes("openai") && !execService.includes("anthropic") && !execService.includes("createCompletion"));
});

test("service does not create embeddings", () => {
  assert.ok(!execService.includes("embedding") && !execService.includes("vectorize"));
});

// ─── Index exports ────────────────────────────────────────────────────────────

test("index exports execution types", () => {
  assert.ok(indexFile.includes("AgentExecutionRequestRecord"));
  assert.ok(indexFile.includes("AgentExecutionEventRecord"));
  assert.ok(indexFile.includes("AgentExecutionPreflightResult"));
});

test("index exports execution validation helpers", () => {
  assert.ok(indexFile.includes("validateAgentExecutionMode"));
  assert.ok(indexFile.includes("redactExecutionPayload"));
  assert.ok(indexFile.includes("normalizeCreateAgentExecutionRequestInput"));
});

test("index exports state machine helpers", () => {
  assert.ok(indexFile.includes("canTransitionAgentExecutionState"));
  assert.ok(indexFile.includes("assertAgentExecutionTransition"));
});

test("index exports registry functions", () => {
  assert.ok(indexFile.includes("createAgentExecutionRequest"));
  assert.ok(indexFile.includes("listAgentExecutionRequests"));
});

test("index exports service functions", () => {
  assert.ok(indexFile.includes("createGovernedAgentExecutionRequest"));
  assert.ok(indexFile.includes("runAgentExecutionPreflight"));
});

// ─── API routes ───────────────────────────────────────────────────────────────

test("GET/POST execution requests route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/route.ts", "utf8");
  assert.ok(routeContent.includes("GET") || routeContent.includes("listAgentExecutionRequests"));
  assert.ok(routeContent.includes("POST") || routeContent.includes("createGovernedAgentExecutionRequest"));
});

test("GET execution request by id route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/route.ts", "utf8");
  assert.ok(routeContent.includes("getAgentExecutionRequestById"));
});

test("POST preflight route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/preflight/route.ts", "utf8");
  assert.ok(routeContent.includes("runAgentExecutionPreflight"));
});

test("POST approve route exists and requires admin", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/approve/route.ts", "utf8");
  assert.ok(routeContent.includes("approveAgentExecutionRequest"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("POST ready route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/ready/route.ts", "utf8");
  assert.ok(routeContent.includes("markAgentExecutionReady"));
});

test("POST complete-dry-run route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/complete-dry-run/route.ts", "utf8");
  assert.ok(routeContent.includes("completeDryRunExecution"));
});

test("POST complete-draft route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/complete-draft/route.ts", "utf8");
  assert.ok(routeContent.includes("completeDraftOnlyExecution"));
});

test("POST cancel route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/cancel/route.ts", "utf8");
  assert.ok(routeContent.includes("cancelAgentExecutionRequest"));
});

test("POST expire route exists and requires admin", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/expire/route.ts", "utf8");
  assert.ok(routeContent.includes("expireAgentExecutionRequest"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("POST fail route exists and requires admin", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/fail/route.ts", "utf8");
  assert.ok(routeContent.includes("failAgentExecution"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("GET events route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/[executionRequestId]/events/route.ts", "utf8");
  assert.ok(routeContent.includes("listAgentExecutionEvents"));
});

test("routes reject missing workspace_id", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/route.ts", "utf8");
  assert.ok(routeContent.includes("MISSING_WORKSPACE"));
});

test("routes do not call LLMs", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/execution/requests/route.ts", "utf8");
  assert.ok(!routeContent.includes("openai") && !routeContent.includes("anthropic"));
});

// ─── Documentation ────────────────────────────────────────────────────────────

test("documentation file exists", () => {
  assert.ok(fs.existsSync("docs/agent-execution-request-runtime.md"));
});

test("documentation mentions Agent Execution", () => {
  const doc = fs.readFileSync("docs/agent-execution-request-runtime.md", "utf8");
  assert.ok(doc.includes("Execution"));
});

// ─── Regression guards ────────────────────────────────────────────────────────

test("agent observability types file still exists", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-observability-types.ts"));
});

test("agent memory registry still exists", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-memory-registry.ts"));
});

test("agent tool registry still exists", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-registry.ts"));
});

test("execution runtime does not import LLM providers", () => {
  for (const src of [execTypes, execValidation, execRegistry, execService]) {
    assert.ok(!src.includes("openai"), "Should not import openai");
    assert.ok(!src.includes("anthropic"), "Should not import anthropic");
    assert.ok(!src.includes("createEmbedding"), "Should not create embeddings");
  }
});
