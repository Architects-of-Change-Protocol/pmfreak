// ─── Agent Tool Execution Adapter Layer — Tests ───────────────────────────────
// Sprint: Agent Tool Execution Adapter Layer
// These tests run without Supabase / a live database.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── Imports ──────────────────────────────────────────────────────────────────

const {
  validateAgentToolAdapterExecutionMode,
  validateAgentToolAdapterStatus,
  validateAgentToolAdapterExecutionStatus,
  validateAgentToolAdapterOutputType,
  validateAgentToolAdapterRiskPolicy,
  validateAgentToolAdapterSideEffectPolicy,
  validateAgentToolAdapterExecutionEventType,
  normalizeAgentToolAdapterDefinition,
  assertAdapterOutputSerializable,
  redactAdapterPayload,
} = await import("../src/lib/agents/agent-tool-adapter-validation.ts");

const {
  getDefaultAgentToolAdapters,
  getAgentToolAdapterByKey,
  findAgentToolAdaptersForToolKey,
  selectAgentToolAdapterForExecutionRequest,
  evaluateAgentToolAdapterEligibility,
} = await import("../src/lib/agents/agent-tool-adapter-registry.ts");

const {
  createAgentToolAdapterExecution,
  updateAgentToolAdapterExecution,
  getAgentToolAdapterExecutionById,
  listAgentToolAdapterExecutions,
  recordAgentToolAdapterExecutionEvent,
  listAgentToolAdapterExecutionEvents,
  runAgentToolAdapter,
  generateAdapterOutput,
} = await import("../src/lib/agents/agent-tool-adapter-service.ts");

// ─── Type / Union Validators ──────────────────────────────────────────────────

describe("Type validators", () => {
  test("validateAgentToolAdapterExecutionMode", () => {
    assert.equal(validateAgentToolAdapterExecutionMode("dry_run"), true);
    assert.equal(validateAgentToolAdapterExecutionMode("draft_only"), true);
    assert.equal(validateAgentToolAdapterExecutionMode("approved_execution"), false);
    assert.equal(validateAgentToolAdapterExecutionMode(""), false);
  });

  test("validateAgentToolAdapterStatus", () => {
    for (const v of ["registered", "enabled", "disabled", "deprecated"]) {
      assert.equal(validateAgentToolAdapterStatus(v), true);
    }
    assert.equal(validateAgentToolAdapterStatus("unknown"), false);
  });

  test("validateAgentToolAdapterExecutionStatus", () => {
    for (const v of ["queued", "running", "succeeded", "failed", "refused", "cancelled"]) {
      assert.equal(validateAgentToolAdapterExecutionStatus(v), true);
    }
    assert.equal(validateAgentToolAdapterExecutionStatus("pending"), false);
  });

  test("validateAgentToolAdapterOutputType", () => {
    for (const v of ["noop", "simulation", "draft_email", "draft_task", "draft_project_update", "draft_report", "recommendation", "structured_summary", "risk_analysis", "governance_note"]) {
      assert.equal(validateAgentToolAdapterOutputType(v), true);
    }
    assert.equal(validateAgentToolAdapterOutputType("live_email"), false);
  });

  test("validateAgentToolAdapterRiskPolicy", () => {
    for (const v of ["low_only", "medium_or_lower", "high_with_approval", "critical_blocked"]) {
      assert.equal(validateAgentToolAdapterRiskPolicy(v), true);
    }
    assert.equal(validateAgentToolAdapterRiskPolicy("none"), false);
  });

  test("validateAgentToolAdapterSideEffectPolicy", () => {
    for (const v of ["none", "internal_draft_only", "internal_record_only", "external_disabled"]) {
      assert.equal(validateAgentToolAdapterSideEffectPolicy(v), true);
    }
    assert.equal(validateAgentToolAdapterSideEffectPolicy("external_enabled"), false);
  });

  test("validateAgentToolAdapterExecutionEventType", () => {
    for (const v of [
      "adapter_execution_created", "adapter_eligibility_checked", "adapter_execution_started",
      "adapter_execution_succeeded", "adapter_execution_failed", "adapter_execution_refused",
      "adapter_execution_cancelled",
    ]) {
      assert.equal(validateAgentToolAdapterExecutionEventType(v), true);
    }
    assert.equal(validateAgentToolAdapterExecutionEventType("adapter_deleted"), false);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("normalizeAgentToolAdapterDefinition", () => {
  const base = {
    adapterKey: "test_adapter",
    displayName: "Test Adapter",
    description: "desc",
    status: "enabled",
    supportedToolKeys: ["tool_a", "tool_b", "tool_a"],
    supportedExecutionModes: ["dry_run"],
    supportedScopeTypes: ["workspace"],
    outputTypes: ["noop"],
    riskPolicy: "medium_or_lower",
    sideEffectPolicy: "none",
    requiresApprovalByDefault: false,
    supportsDryRun: true,
    supportsDraftOnly: false,
    externalSideEffectsPossible: false,
    externalSideEffectsEnabled: false,
    version: "1.0.0",
    owner: null,
    policyNotes: [],
  };

  test("deduplicates supportedToolKeys", () => {
    const result = normalizeAgentToolAdapterDefinition(base);
    assert.deepEqual(result.supportedToolKeys, ["tool_a", "tool_b"]);
  });

  test("throws on empty adapterKey", () => {
    assert.throws(() => normalizeAgentToolAdapterDefinition({ ...base, adapterKey: "" }), /adapterKey/);
  });

  test("throws on empty displayName", () => {
    assert.throws(() => normalizeAgentToolAdapterDefinition({ ...base, displayName: "  " }), /displayName/);
  });

  test("throws on invalid status", () => {
    assert.throws(() => normalizeAgentToolAdapterDefinition({ ...base, status: "active" }), /status/);
  });

  test("throws on externalSideEffectsEnabled=true", () => {
    assert.throws(() => normalizeAgentToolAdapterDefinition({ ...base, externalSideEffectsEnabled: true }), /external/i);
  });

  test("throws on invalid outputType", () => {
    assert.throws(() => normalizeAgentToolAdapterDefinition({ ...base, outputTypes: ["live_send"] }), /outputType/);
  });

  test("throws on empty supportedToolKeys", () => {
    assert.throws(() => normalizeAgentToolAdapterDefinition({ ...base, supportedToolKeys: [] }), /supportedToolKeys/);
  });
});

describe("assertAdapterOutputSerializable", () => {
  test("passes for plain objects", () => {
    assert.doesNotThrow(() => assertAdapterOutputSerializable({ type: "noop", value: 42 }));
  });

  test("passes for null", () => {
    assert.doesNotThrow(() => assertAdapterOutputSerializable(null));
  });

  test("throws for circular references", () => {
    const obj = {};
    obj.self = obj;
    assert.throws(() => assertAdapterOutputSerializable(obj));
  });
});

describe("redactAdapterPayload", () => {
  test("returns null for null input", () => {
    assert.equal(redactAdapterPayload(null), null);
  });

  test("redacts sensitive keys", () => {
    const result = redactAdapterPayload({
      title: "hello",
      password: "secret123",
      token: "abc",
      apiKey: "key",
      api_key: "key2",
      authorization: "Bearer xyz",
      stripe_secret: "sk_live_abc",
      private_key: "-----BEGIN",
      credential: "cred",
      client_secret: "cs",
      refresh_token: "rt",
      access_token: "at",
      session_cookie: "sc",
      cookie: "c",
    });
    assert.equal(result.title, "hello");
    for (const key of ["password", "token", "apiKey", "api_key", "authorization", "stripe_secret", "private_key", "credential", "client_secret", "refresh_token", "access_token", "session_cookie", "cookie"]) {
      assert.equal(result[key], "[REDACTED]");
    }
  });

  test("recursively redacts nested objects", () => {
    const result = redactAdapterPayload({ nested: { password: "hidden", name: "ok" } });
    assert.equal(result.nested.password, "[REDACTED]");
    assert.equal(result.nested.name, "ok");
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("Registry", () => {
  test("getDefaultAgentToolAdapters returns 6 adapters", () => {
    const adapters = getDefaultAgentToolAdapters();
    assert.equal(adapters.length, 6);
  });

  test("all adapter keys are unique", () => {
    const adapters = getDefaultAgentToolAdapters();
    const keys = adapters.map((a) => a.adapterKey);
    assert.equal(new Set(keys).size, keys.length);
  });

  test("all adapters have externalSideEffectsEnabled=false", () => {
    const adapters = getDefaultAgentToolAdapters();
    for (const a of adapters) {
      assert.equal(a.externalSideEffectsEnabled, false, `${a.adapterKey} has external side effects enabled`);
    }
  });

  test("getAgentToolAdapterByKey finds noop_adapter", () => {
    const a = getAgentToolAdapterByKey("noop_adapter");
    assert.ok(a);
    assert.equal(a.adapterKey, "noop_adapter");
  });

  test("getAgentToolAdapterByKey returns null for unknown key", () => {
    assert.equal(getAgentToolAdapterByKey("nonexistent"), null);
  });

  test("findAgentToolAdaptersForToolKey finds draft_email_adapter for draft_client_email", () => {
    const adapters = findAgentToolAdaptersForToolKey("draft_client_email");
    assert.ok(adapters.some((a) => a.adapterKey === "draft_email_adapter"));
  });

  test("findAgentToolAdaptersForToolKey returns empty for unknown tool", () => {
    const adapters = findAgentToolAdaptersForToolKey("unknown_tool_xyz");
    assert.equal(adapters.length, 0);
  });

  test("selectAgentToolAdapterForExecutionRequest selects noop for noop tool", () => {
    const adapter = selectAgentToolAdapterForExecutionRequest({
      toolKey: "noop",
      executionMode: "dry_run",
      scopeType: "workspace",
      riskLevel: "low",
      requiresApproval: false,
    });
    assert.ok(adapter);
    assert.equal(adapter.adapterKey, "noop_adapter");
  });

  test("selectAgentToolAdapterForExecutionRequest returns null for unsupported tool", () => {
    const adapter = selectAgentToolAdapterForExecutionRequest({
      toolKey: "unknown_xyz",
      executionMode: "dry_run",
      scopeType: "workspace",
      riskLevel: "low",
      requiresApproval: false,
    });
    assert.equal(adapter, null);
  });
});

// ─── Eligibility Evaluation ───────────────────────────────────────────────────

describe("evaluateAgentToolAdapterEligibility", () => {
  const makeReq = (overrides = {}) => ({
    id: "req-1",
    workspaceId: "ws-1",
    correlationId: null,
    agentId: null,
    agentType: null,
    toolKey: "noop",
    executionMode: "dry_run",
    executionState: "ready_for_execution",
    riskLevel: "low",
    scopeType: "workspace",
    scopeId: null,
    requiresApproval: false,
    approvalRequestId: null,
    memoryIds: [],
    evidenceRefs: [],
    payload: null,
    preflightStatus: "passed",
    preflightResult: null,
    outputPayload: null,
    requestedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  });

  const noopAdapter = getAgentToolAdapterByKey("noop_adapter");

  test("eligible for valid noop request", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq() });
    assert.equal(result.eligible, true);
    assert.equal(result.reasonCode, "eligible");
  });

  test("not eligible if executionRequest is null", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: null });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "execution_request_not_found");
  });

  test("not eligible if state is not ready_for_execution", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq({ executionState: "draft" }) });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "execution_request_not_ready");
  });

  test("not eligible if adapter is null", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: null, executionRequest: makeReq() });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "adapter_not_found");
  });

  test("not eligible if adapter is disabled", () => {
    const disabled = { ...noopAdapter, status: "disabled" };
    const result = evaluateAgentToolAdapterEligibility({ adapter: disabled, executionRequest: makeReq() });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "adapter_disabled");
  });

  test("not eligible if execution mode is approved_execution", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq({ executionMode: "approved_execution" }) });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "unsupported_execution_mode");
  });

  test("not eligible if tool key not supported by adapter", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq({ toolKey: "draft_client_email" }) });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "unsupported_tool_key");
  });

  test("not eligible if risk level is critical", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq({ riskLevel: "critical" }) });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "risk_policy_denied");
  });

  test("not eligible if high risk and policy is medium_or_lower", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq({ riskLevel: "high" }) });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "risk_policy_denied");
  });

  test("not eligible for high risk with approval policy but no approval", () => {
    const emailAdapter = getAgentToolAdapterByKey("draft_email_adapter");
    const result = evaluateAgentToolAdapterEligibility({
      adapter: emailAdapter,
      executionRequest: makeReq({
        toolKey: "draft_client_email",
        executionMode: "dry_run",
        riskLevel: "high",
        requiresApproval: false,
        approvalRequestId: null,
      }),
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "approval_required");
  });

  test("has checks array on result", () => {
    const result = evaluateAgentToolAdapterEligibility({ adapter: noopAdapter, executionRequest: makeReq() });
    assert.ok(Array.isArray(result.checks));
    assert.ok(result.checks.length > 0);
    for (const check of result.checks) {
      assert.ok("key" in check);
      assert.ok("passed" in check);
      assert.ok("message" in check);
    }
  });
});

// ─── Service Tests ────────────────────────────────────────────────────────────

describe("Service: in-memory CRUD", () => {
  test("createAgentToolAdapterExecution stores and retrieves a record", async () => {
    const now = new Date().toISOString();
    const record = await createAgentToolAdapterExecution({
      workspaceId: "ws-test",
      executionRequestId: "req-test",
      adapterKey: "noop_adapter",
      toolKey: "noop",
      executionMode: "dry_run",
      executionStatus: "queued",
      outputType: "noop",
      inputSnapshot: null,
      safeInputSnapshot: null,
      outputPayload: null,
      evidenceRefs: [],
      warnings: [],
      refusalReason: null,
      errorCode: null,
      errorMessage: null,
      actorId: null,
      startedAt: now,
      completedAt: null,
    });
    assert.ok(record.id);
    assert.equal(record.adapterKey, "noop_adapter");
    assert.equal(record.executionStatus, "queued");

    const fetched = await getAgentToolAdapterExecutionById("ws-test", record.id);
    assert.deepEqual(fetched, record);
  });

  test("updateAgentToolAdapterExecution updates status", async () => {
    const now = new Date().toISOString();
    const record = await createAgentToolAdapterExecution({
      workspaceId: "ws-test2",
      executionRequestId: "req-test2",
      adapterKey: "noop_adapter",
      toolKey: "noop",
      executionMode: "dry_run",
      executionStatus: "queued",
      outputType: "noop",
      inputSnapshot: null,
      safeInputSnapshot: null,
      outputPayload: null,
      evidenceRefs: [],
      warnings: [],
      refusalReason: null,
      errorCode: null,
      errorMessage: null,
      actorId: null,
      startedAt: now,
      completedAt: null,
    });
    const updated = await updateAgentToolAdapterExecution(record.id, { executionStatus: "running" });
    assert.equal(updated.executionStatus, "running");
  });

  test("listAgentToolAdapterExecutions filters by workspaceId", async () => {
    const results = await listAgentToolAdapterExecutions("ws-test");
    assert.ok(Array.isArray(results));
    for (const r of results) {
      assert.equal(r.workspaceId, "ws-test");
    }
  });

  test("recordAgentToolAdapterExecutionEvent stores and lists events", async () => {
    const event = await recordAgentToolAdapterExecutionEvent({
      workspaceId: "ws-test",
      adapterExecutionId: "exec-fake-id",
      executionRequestId: "req-fake",
      eventType: "adapter_execution_created",
      message: "test event",
      eventPayload: null,
      actorId: null,
    });
    assert.ok(event.id);
    assert.equal(event.eventType, "adapter_execution_created");

    const events = await listAgentToolAdapterExecutionEvents("ws-test", "exec-fake-id");
    assert.ok(events.some((e) => e.id === event.id));
  });
});

describe("Service: runAgentToolAdapter (refused path — no DB)", () => {
  test("returns refused result when executionRequest not found", async () => {
    const result = await runAgentToolAdapter({
      workspaceId: "ws-nodb",
      executionRequestId: "req-does-not-exist",
    });
    assert.equal(result.status, "refused");
    assert.ok(result.refusalReason);
    assert.equal(typeof result.startedAt, "string");
    assert.equal(typeof result.completedAt, "string");
  });
});

// ─── generateAdapterOutput ────────────────────────────────────────────────────

describe("generateAdapterOutput", () => {
  const fakeReq = {
    id: "req-1",
    workspaceId: "ws-1",
    toolKey: "noop",
    riskLevel: "low",
    executionMode: "dry_run",
    executionState: "ready_for_execution",
    scopeType: "workspace",
    scopeId: null,
    inputPayload: { title: "My Title", summary: "My Summary", description: "My Desc" },
  };

  test("noop_adapter returns noop output", () => {
    const out = generateAdapterOutput("noop_adapter", "noop", fakeReq, null);
    assert.equal(out.type, "noop");
    assert.equal(out.wouldExecute, false);
  });

  test("draft_email_adapter uses title from payload", () => {
    const out = generateAdapterOutput("draft_email_adapter", "draft_email", fakeReq, fakeReq.inputPayload);
    assert.equal(out.type, "draft_email");
    assert.ok(String(out.subject).includes("My Title"));
    assert.equal(out.sendStatus, "not_sent");
    assert.equal(out.requiresHumanReview, true);
  });

  test("draft_task_adapter uses title and description", () => {
    const out = generateAdapterOutput("draft_task_adapter", "draft_task", fakeReq, fakeReq.inputPayload);
    assert.equal(out.type, "draft_task");
    assert.equal(out.title, "My Title");
    assert.equal(out.requiresHumanReview, true);
  });

  test("draft_project_update_adapter uses summary", () => {
    const out = generateAdapterOutput("draft_project_update_adapter", "draft_project_update", fakeReq, fakeReq.inputPayload);
    assert.equal(out.type, "draft_project_update");
    assert.equal(out.summary, "My Summary");
    assert.equal(out.appliedToProject, false);
  });

  test("executive_summary_adapter uses summary", () => {
    const out = generateAdapterOutput("executive_summary_adapter", "structured_summary", fakeReq, fakeReq.inputPayload);
    assert.equal(out.type, "structured_summary");
    assert.equal(out.summary, "My Summary");
    assert.ok(Array.isArray(out.sections));
  });

  test("risk_analysis_adapter uses riskLevel", () => {
    const out = generateAdapterOutput("risk_analysis_adapter", "risk_analysis", fakeReq, null);
    assert.equal(out.type, "risk_analysis");
    assert.equal(out.riskLevel, "low");
    assert.ok(Array.isArray(out.findings));
    assert.ok(Array.isArray(out.recommendations));
  });
});

// ─── Migration File ───────────────────────────────────────────────────────────

describe("Migration file", () => {
  const migrationPath = resolve(ROOT, "supabase/migrations/20260731000000_agent_tool_execution_adapter_layer.sql");

  test("migration file exists", () => {
    assert.ok(existsSync(migrationPath), "Migration file does not exist");
  });

  test("migration contains agent_tool_adapter_executions table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_tool_adapter_executions"), "Missing table definition");
  });

  test("migration contains agent_tool_adapter_execution_events table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_tool_adapter_execution_events"), "Missing events table");
  });

  test("migration has RLS policies", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("row level security"), "Missing RLS");
    assert.ok(sql.includes("workspace_members_read_adapter_executions"), "Missing read policy");
  });
});

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database contract", () => {
  const contractPath = resolve(ROOT, "src/lib/db/database-contract.ts");

  test("contract file exists", () => {
    assert.ok(existsSync(contractPath));
  });

  test("contract contains AgentToolAdapterExecutionRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentToolAdapterExecutionRow"));
  });

  test("contract contains AgentToolAdapterExecutionEventRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentToolAdapterExecutionEventRow"));
  });

  test("contract version includes agent-tool-execution-adapter-layer", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("agent-tool-execution-adapter-layer"), "VERSION not updated");
  });
});

// ─── API Route Files ──────────────────────────────────────────────────────────

describe("API route files exist", () => {
  const routeFiles = [
    "src/app/api/agents/execution/adapters/route.ts",
    "src/app/api/agents/execution/adapters/[adapterKey]/route.ts",
    "src/app/api/agents/execution/requests/[executionRequestId]/adapter-run/route.ts",
    "src/app/api/agents/execution/adapter-executions/route.ts",
    "src/app/api/agents/execution/adapter-executions/[adapterExecutionId]/route.ts",
    "src/app/api/agents/execution/adapter-executions/[adapterExecutionId]/events/route.ts",
  ];

  for (const relPath of routeFiles) {
    test(`exists: ${relPath}`, () => {
      assert.ok(existsSync(resolve(ROOT, relPath)), `Missing: ${relPath}`);
    });
  }

  test("adapter-run route contains runAgentToolAdapter", () => {
    const content = readFileSync(resolve(ROOT, "src/app/api/agents/execution/requests/[executionRequestId]/adapter-run/route.ts"), "utf8");
    assert.ok(content.includes("runAgentToolAdapter"));
  });

  test("adapters route contains getDefaultAgentToolAdapters", () => {
    const content = readFileSync(resolve(ROOT, "src/app/api/agents/execution/adapters/route.ts"), "utf8");
    assert.ok(content.includes("getDefaultAgentToolAdapters"));
  });
});

// ─── Observability Types ──────────────────────────────────────────────────────

describe("Observability types updated", () => {
  const obsTypesPath = resolve(ROOT, "src/lib/agents/agent-observability-types.ts");

  test("agent_tool_adapter_layer source type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("agent_tool_adapter_layer"), "Missing source type");
  });

  test("adapter_execution_succeeded event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("adapter_execution_succeeded"), "Missing event type");
  });

  test("adapter_execution_refused event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("adapter_execution_refused"), "Missing event type");
  });
});

// ─── Index Exports ────────────────────────────────────────────────────────────

describe("index.ts exports", () => {
  const indexPath = resolve(ROOT, "src/lib/agents/index.ts");

  test("exports runAgentToolAdapter", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("runAgentToolAdapter"));
  });

  test("exports getDefaultAgentToolAdapters", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("getDefaultAgentToolAdapters"));
  });

  test("exports redactAdapterPayload", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("redactAdapterPayload"));
  });
});

// ─── No-side-effect checks ────────────────────────────────────────────────────

describe("No prohibited patterns in service/registry", () => {
  const serviceContent = readFileSync(resolve(ROOT, "src/lib/agents/agent-tool-adapter-service.ts"), "utf8");
  const registryContent = readFileSync(resolve(ROOT, "src/lib/agents/agent-tool-adapter-registry.ts"), "utf8");

  test("service does not import openai/anthropic/gemini", () => {
    assert.ok(!serviceContent.includes("openai") && !serviceContent.includes("anthropic") && !serviceContent.includes("gemini"));
  });

  test("service does not call fetch(", () => {
    // Allow 'fetch' in comments/strings only — simple check: no standalone fetch( calls
    assert.ok(!serviceContent.match(/\bfetch\s*\(/));
  });

  test("service does not send emails or call external webhooks", () => {
    assert.ok(!serviceContent.includes("sendEmail") && !serviceContent.includes("send_email") && !serviceContent.includes("webhook"));
  });

  test("registry does not import supabase", () => {
    assert.ok(!registryContent.includes("supabase") && !registryContent.includes("@/lib/db"));
  });

  test("service does not import @/lib/db directly", () => {
    assert.ok(!serviceContent.includes("@/lib/db"));
  });
});
