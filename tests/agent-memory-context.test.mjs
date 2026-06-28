import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Load source files ────────────────────────────────────────────────────────

const memoryTypes = fs.readFileSync("src/lib/agents/agent-memory-types.ts", "utf8");
const memoryValidation = fs.readFileSync("src/lib/agents/agent-memory-validation.ts", "utf8");
const memoryPolicy = fs.readFileSync("src/lib/agents/agent-memory-policy.ts", "utf8");
const memoryRegistry = fs.readFileSync("src/lib/agents/agent-memory-registry.ts", "utf8");
const memoryService = fs.readFileSync("src/lib/agents/agent-memory-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260728000000_agent_memory_context_layer.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/agents/index.ts", "utf8");

// ─── Pure module imports ──────────────────────────────────────────────────────

const {
  validateAgentContextScopeType,
  validateAgentMemoryKind,
  validateAgentMemoryStatus,
  validateAgentContextSensitivity,
  validateAgentContextSourceType,
  validateAgentMemoryRetentionPolicy,
  validateAgentMemoryEventType,
  validateAgentContextPolicyStatus,
  assertAgentMemoryPayloadSerializable,
  normalizeCreateAgentMemoryInput,
  normalizeCreateAgentContextPolicyInput,
} = await import("../src/lib/agents/agent-memory-validation.ts");

const {
  getSensitivityRank,
  isSensitivityAllowed,
  calculateExpiration,
  evaluateMemoryPolicy,
} = await import("../src/lib/agents/agent-memory-policy.ts");

// ─── Type definitions ─────────────────────────────────────────────────────────

test("AgentContextScopeType contains all required values", () => {
  for (const v of ["workspace", "portfolio", "project", "pm", "agent", "tool_request", "approval_request"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing scope type: ${v}`);
  }
});

test("AgentMemoryKind contains all required values", () => {
  for (const v of ["fact", "summary", "decision", "risk", "issue", "preference", "constraint", "lesson_learned", "operating_context", "evidence_reference"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing memory kind: ${v}`);
  }
});

test("AgentMemoryStatus contains all required values", () => {
  for (const v of ["active", "stale", "expired", "revoked", "archived"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing memory status: ${v}`);
  }
});

test("AgentContextSensitivity contains all required values", () => {
  for (const v of ["public", "internal", "confidential", "restricted"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing sensitivity: ${v}`);
  }
});

test("AgentContextSourceType contains all required values", () => {
  for (const v of ["manual", "project_record", "pm_profile", "capacity_snapshot", "performance_snapshot", "governance_event", "tool_request", "approval_decision", "executive_report", "uploaded_artifact", "meeting_notes", "system_generated"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing source type: ${v}`);
  }
});

test("AgentMemoryRetentionPolicy contains all required values", () => {
  for (const v of ["session_only", "short_term", "project_lifetime", "workspace_lifetime", "custom"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing retention policy: ${v}`);
  }
});

test("AgentMemoryEventType contains all required values", () => {
  for (const v of ["memory_created", "memory_updated", "memory_accessed", "memory_policy_evaluated", "memory_marked_stale", "memory_expired", "memory_revoked", "memory_archived", "sensitivity_changed", "retention_changed", "source_refreshed"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing event type: ${v}`);
  }
});

test("AgentMemoryAccessState contains all required values", () => {
  for (const v of ["allowed", "denied", "requires_approval", "expired", "revoked", "stale"]) {
    assert.ok(memoryTypes.includes(`"${v}"`), `Missing access state: ${v}`);
  }
});

// ─── Scope type validation ────────────────────────────────────────────────────

test("validateAgentContextScopeType accepts valid scope types", () => {
  for (const v of ["workspace", "portfolio", "project", "pm", "agent", "tool_request", "approval_request"]) {
    assert.ok(validateAgentContextScopeType(v), `Expected ${v} to be valid`);
  }
});

test("validateAgentContextScopeType rejects invalid scope type", () => {
  assert.equal(validateAgentContextScopeType("global"), false);
  assert.equal(validateAgentContextScopeType(""), false);
  assert.equal(validateAgentContextScopeType("WORKSPACE"), false);
});

// ─── Memory kind validation ───────────────────────────────────────────────────

test("validateAgentMemoryKind accepts valid memory kinds", () => {
  for (const v of ["fact", "summary", "decision", "risk", "issue", "preference", "constraint", "lesson_learned", "operating_context", "evidence_reference"]) {
    assert.ok(validateAgentMemoryKind(v));
  }
});

test("validateAgentMemoryKind rejects invalid memory kind", () => {
  assert.equal(validateAgentMemoryKind("note"), false);
  assert.equal(validateAgentMemoryKind("FACT"), false);
});

// ─── Memory status validation ─────────────────────────────────────────────────

test("validateAgentMemoryStatus accepts valid statuses", () => {
  for (const v of ["active", "stale", "expired", "revoked", "archived"]) {
    assert.ok(validateAgentMemoryStatus(v));
  }
});

test("validateAgentMemoryStatus rejects invalid status", () => {
  assert.equal(validateAgentMemoryStatus("deleted"), false);
  assert.equal(validateAgentMemoryStatus("pending"), false);
});

// ─── Sensitivity validation ───────────────────────────────────────────────────

test("validateAgentContextSensitivity accepts valid levels", () => {
  for (const v of ["public", "internal", "confidential", "restricted"]) {
    assert.ok(validateAgentContextSensitivity(v));
  }
});

test("validateAgentContextSensitivity rejects invalid level", () => {
  assert.equal(validateAgentContextSensitivity("secret"), false);
  assert.equal(validateAgentContextSensitivity(""), false);
});

// ─── Source type validation ───────────────────────────────────────────────────

test("validateAgentContextSourceType accepts valid source types", () => {
  for (const v of ["manual", "project_record", "system_generated"]) {
    assert.ok(validateAgentContextSourceType(v));
  }
});

test("validateAgentContextSourceType rejects invalid source type", () => {
  assert.equal(validateAgentContextSourceType("external_api"), false);
});

// ─── Retention policy validation ──────────────────────────────────────────────

test("validateAgentMemoryRetentionPolicy accepts valid policies", () => {
  for (const v of ["session_only", "short_term", "project_lifetime", "workspace_lifetime", "custom"]) {
    assert.ok(validateAgentMemoryRetentionPolicy(v));
  }
});

test("validateAgentMemoryRetentionPolicy rejects invalid policy", () => {
  assert.equal(validateAgentMemoryRetentionPolicy("forever"), false);
});

// ─── Event type validation ────────────────────────────────────────────────────

test("validateAgentMemoryEventType accepts all event types", () => {
  for (const v of ["memory_created", "memory_accessed", "memory_expired", "memory_revoked", "memory_archived", "sensitivity_changed"]) {
    assert.ok(validateAgentMemoryEventType(v));
  }
});

test("validateAgentMemoryEventType rejects invalid type", () => {
  assert.equal(validateAgentMemoryEventType("memory_deleted"), false);
});

// ─── Secret payload guard ─────────────────────────────────────────────────────

test("assertAgentMemoryPayloadSerializable accepts benign payload", () => {
  assert.doesNotThrow(() => assertAgentMemoryPayloadSerializable({ meetingDate: "2026-07-28", capturedBy: "PM" }));
});

test("assertAgentMemoryPayloadSerializable rejects password key", () => {
  assert.throws(() => assertAgentMemoryPayloadSerializable({ password: "hunter2" }), /sensitive/);
});

test("assertAgentMemoryPayloadSerializable rejects token key", () => {
  assert.throws(() => assertAgentMemoryPayloadSerializable({ token: "abc123" }), /sensitive/);
});

test("assertAgentMemoryPayloadSerializable rejects access_token key", () => {
  assert.throws(() => assertAgentMemoryPayloadSerializable({ access_token: "xyz" }), /sensitive/);
});

test("assertAgentMemoryPayloadSerializable rejects apiKey key", () => {
  assert.throws(() => assertAgentMemoryPayloadSerializable({ apiKey: "key_123" }), /sensitive/);
});

test("assertAgentMemoryPayloadSerializable accepts null", () => {
  assert.doesNotThrow(() => assertAgentMemoryPayloadSerializable(null));
});

// ─── Memory input normalization ───────────────────────────────────────────────

test("normalizeCreateAgentMemoryInput requires workspaceId", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test",
    sourceType: "manual",
  }), /workspaceId/);
});

test("normalizeCreateAgentMemoryInput requires title", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "  ",
    sourceType: "manual",
  }), /title/);
});

test("normalizeCreateAgentMemoryInput enforces title max length", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "x".repeat(201),
    sourceType: "manual",
  }), /200/);
});

test("normalizeCreateAgentMemoryInput rejects invalid scopeType", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "global",
    memoryKind: "fact",
    title: "Test",
    sourceType: "manual",
  }), /scopeType/);
});

test("normalizeCreateAgentMemoryInput defaults sensitivity to internal", () => {
  const result = normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test fact",
    sourceType: "manual",
  });
  assert.equal(result.sensitivity, "internal");
});

test("normalizeCreateAgentMemoryInput defaults retentionPolicy to short_term", () => {
  const result = normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test fact",
    sourceType: "manual",
  });
  assert.equal(result.retentionPolicy, "short_term");
});

test("normalizeCreateAgentMemoryInput requires retentionDays for custom policy", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test",
    sourceType: "manual",
    retentionPolicy: "custom",
  }), /retentionDays/);
});

test("normalizeCreateAgentMemoryInput rejects negative retentionDays", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test",
    sourceType: "manual",
    retentionPolicy: "custom",
    retentionDays: -5,
  }), /positive/);
});

test("normalizeCreateAgentMemoryInput rejects expiresAt in the past", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test",
    sourceType: "manual",
    expiresAt: "2020-01-01T00:00:00Z",
  }), /future/);
});

test("normalizeCreateAgentMemoryInput rejects provenance with secret keys", () => {
  assert.throws(() => normalizeCreateAgentMemoryInput({
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test",
    sourceType: "manual",
    provenance: { secret: "shhh" },
  }), /sensitive/);
});

// ─── Policy key normalization ─────────────────────────────────────────────────

test("normalizeCreateAgentContextPolicyInput requires policyKey", () => {
  assert.throws(() => normalizeCreateAgentContextPolicyInput({
    workspaceId: "ws1",
    policyKey: "",
    displayName: "Test",
  }), /policyKey/);
});

test("normalizeCreateAgentContextPolicyInput enforces snake_case policyKey", () => {
  assert.throws(() => normalizeCreateAgentContextPolicyInput({
    workspaceId: "ws1",
    policyKey: "My Policy",
    displayName: "Test",
  }), /snake_case/);
});

test("normalizeCreateAgentContextPolicyInput accepts valid policyKey", () => {
  const result = normalizeCreateAgentContextPolicyInput({
    workspaceId: "ws1",
    policyKey: "default_agent_context_policy",
    displayName: "Default Policy",
  });
  assert.equal(result.policyKey, "default_agent_context_policy");
});

test("normalizeCreateAgentContextPolicyInput deduplicates scope types", () => {
  const result = normalizeCreateAgentContextPolicyInput({
    workspaceId: "ws1",
    policyKey: "test_policy",
    displayName: "Test",
    allowedScopeTypes: ["project", "project", "workspace"],
  });
  assert.equal(result.allowedScopeTypes.length, 2);
});

// ─── Sensitivity policy ───────────────────────────────────────────────────────

test("getSensitivityRank returns correct ranks", () => {
  assert.equal(getSensitivityRank("public"), 0);
  assert.equal(getSensitivityRank("internal"), 1);
  assert.equal(getSensitivityRank("confidential"), 2);
  assert.equal(getSensitivityRank("restricted"), 3);
});

test("isSensitivityAllowed: public allowed under internal", () => {
  assert.ok(isSensitivityAllowed({ memorySensitivity: "public", allowedSensitivity: "internal" }));
});

test("isSensitivityAllowed: internal allowed under internal", () => {
  assert.ok(isSensitivityAllowed({ memorySensitivity: "internal", allowedSensitivity: "internal" }));
});

test("isSensitivityAllowed: confidential denied under internal", () => {
  assert.equal(isSensitivityAllowed({ memorySensitivity: "confidential", allowedSensitivity: "internal" }), false);
});

test("isSensitivityAllowed: restricted denied under confidential", () => {
  assert.equal(isSensitivityAllowed({ memorySensitivity: "restricted", allowedSensitivity: "confidential" }), false);
});

test("isSensitivityAllowed: restricted allowed under restricted", () => {
  assert.ok(isSensitivityAllowed({ memorySensitivity: "restricted", allowedSensitivity: "restricted" }));
});

// ─── Expiration calculation ───────────────────────────────────────────────────

test("calculateExpiration returns future date for short_term", () => {
  const result = calculateExpiration({ retentionPolicy: "short_term" });
  assert.ok(result !== null);
  assert.ok(new Date(result) > new Date());
});

test("calculateExpiration returns null for workspace_lifetime", () => {
  const result = calculateExpiration({ retentionPolicy: "workspace_lifetime" });
  assert.equal(result, null);
});

test("calculateExpiration returns null for project_lifetime", () => {
  const result = calculateExpiration({ retentionPolicy: "project_lifetime" });
  assert.equal(result, null);
});

test("calculateExpiration returns future for custom with retentionDays", () => {
  const result = calculateExpiration({ retentionPolicy: "custom", retentionDays: 14 });
  assert.ok(result !== null);
  assert.ok(new Date(result) > new Date());
});

test("calculateExpiration returns null for custom without retentionDays", () => {
  const result = calculateExpiration({ retentionPolicy: "custom", retentionDays: null });
  assert.equal(result, null);
});

test("calculateExpiration session_only expires in 24h", () => {
  const base = new Date();
  const result = calculateExpiration({ retentionPolicy: "session_only", createdAt: base });
  assert.ok(result !== null);
  const expiry = new Date(result);
  const diff = expiry.getTime() - base.getTime();
  assert.ok(Math.abs(diff - 24 * 60 * 60 * 1000) < 1000, "Should be ~24h");
});

// ─── Policy evaluation ────────────────────────────────────────────────────────

function makePolicy(overrides = {}) {
  return {
    id: "pol1",
    workspaceId: "ws1",
    policyKey: "default_agent_context_policy",
    displayName: "Default",
    description: null,
    allowedScopeTypes: [],
    allowedMemoryKinds: [],
    maxSensitivity: "confidential",
    defaultRetentionPolicy: "short_term",
    defaultRetentionDays: 30,
    allowCrossProjectMemory: false,
    allowCrossPmMemory: false,
    allowPortfolioMemory: true,
    allowRestrictedMemory: false,
    requireApprovalForConfidential: true,
    requireApprovalForRestricted: true,
    hideExpiredMemory: true,
    status: "active",
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMemory(overrides = {}) {
  return {
    workspaceId: "ws1",
    scopeType: "project",
    memoryKind: "fact",
    title: "Test fact",
    sourceType: "manual",
    sensitivity: "internal",
    retentionPolicy: "short_term",
    ...overrides,
  };
}

test("evaluateMemoryPolicy: internal memory allowed under confidential policy", () => {
  const result = evaluateMemoryPolicy({ policy: makePolicy(), memory: makeMemory({ sensitivity: "internal" }) });
  assert.ok(result.allowed);
  assert.equal(result.reasonCode, "allowed");
});

test("evaluateMemoryPolicy: confidential requires approval", () => {
  const result = evaluateMemoryPolicy({ policy: makePolicy(), memory: makeMemory({ sensitivity: "confidential" }) });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "confidential_requires_approval");
});

test("evaluateMemoryPolicy: restricted denied when not allowed", () => {
  // Default policy maxSensitivity is "confidential", so restricted exceeds it → sensitivity_not_allowed fires first
  const result = evaluateMemoryPolicy({ policy: makePolicy(), memory: makeMemory({ sensitivity: "restricted" }) });
  assert.equal(result.allowed, false);
  assert.ok(["sensitivity_not_allowed", "restricted_not_allowed"].includes(result.reasonCode), `Unexpected reasonCode: ${result.reasonCode}`);
});

test("evaluateMemoryPolicy: restricted requires approval when allowRestrictedMemory is true", () => {
  const policy = makePolicy({ allowRestrictedMemory: true, maxSensitivity: "restricted" });
  const result = evaluateMemoryPolicy({ policy, memory: makeMemory({ sensitivity: "restricted" }) });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "restricted_requires_approval");
});

test("evaluateMemoryPolicy: scope denied if not in allowed list", () => {
  const policy = makePolicy({ allowedScopeTypes: ["workspace", "agent"] });
  const result = evaluateMemoryPolicy({ policy, memory: makeMemory({ scopeType: "project" }) });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "scope_not_allowed");
});

test("evaluateMemoryPolicy: scope allowed if list is empty", () => {
  const policy = makePolicy({ allowedScopeTypes: [] });
  const result = evaluateMemoryPolicy({ policy, memory: makeMemory({ scopeType: "project" }) });
  assert.ok(result.allowed);
});

test("evaluateMemoryPolicy: memory kind denied if not in allowed list", () => {
  const policy = makePolicy({ allowedMemoryKinds: ["fact", "summary"] });
  const result = evaluateMemoryPolicy({ policy, memory: makeMemory({ memoryKind: "decision" }) });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "memory_kind_not_allowed");
});

test("evaluateMemoryPolicy: sensitivity above maxSensitivity denied", () => {
  const policy = makePolicy({ maxSensitivity: "internal" });
  const result = evaluateMemoryPolicy({ policy, memory: makeMemory({ sensitivity: "confidential" }) });
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "sensitivity_not_allowed");
});

test("evaluateMemoryPolicy: public memory allowed under internal max", () => {
  const policy = makePolicy({ maxSensitivity: "internal", requireApprovalForConfidential: true });
  const result = evaluateMemoryPolicy({ policy, memory: makeMemory({ sensitivity: "public" }) });
  assert.ok(result.allowed);
});

// ─── Migration ────────────────────────────────────────────────────────────────

test("Migration creates agent_context_policies table", () => {
  assert.match(migration, /create table.*agent_context_policies/s);
});

test("Migration creates agent_memory_records table", () => {
  assert.match(migration, /create table.*agent_memory_records/s);
});

test("Migration creates agent_memory_events table", () => {
  assert.match(migration, /create table.*agent_memory_events/s);
});

test("Migration creates agent_context_windows table", () => {
  assert.match(migration, /create table.*agent_context_windows/s);
});

test("Migration enables RLS on all tables", () => {
  assert.ok((migration.match(/enable row level security/g) ?? []).length >= 4);
});

test("Migration creates workspace member read policy for memory", () => {
  assert.match(migration, /workspace_members_read_memory/);
});

test("Migration creates workspace admin update policy for memory", () => {
  assert.match(migration, /workspace_admins_update_memory/);
});

// ─── Database contract ────────────────────────────────────────────────────────

test("Database contract includes AgentContextPolicyRow", () => {
  assert.match(contract, /AgentContextPolicyRow/);
});

test("Database contract includes AgentMemoryRecordRow", () => {
  assert.match(contract, /AgentMemoryRecordRow/);
});

test("Database contract includes AgentMemoryEventRow", () => {
  assert.match(contract, /AgentMemoryEventRow/);
});

test("Database contract includes AgentContextWindowRow", () => {
  assert.match(contract, /AgentContextWindowRow/);
});

test("Database contract version updated for memory context layer", () => {
  assert.match(contract, /agent-memory-context-layer/);
});

// ─── Index exports ────────────────────────────────────────────────────────────

test("Index exports memory types", () => {
  assert.match(indexFile, /AgentMemoryRecord/);
  assert.match(indexFile, /AgentContextPolicyRecord/);
  assert.match(indexFile, /AgentMemoryEventRecord/);
});

test("Index exports memory service functions", () => {
  assert.match(indexFile, /createGovernedAgentMemory/);
  assert.match(indexFile, /checkAgentMemoryAccess/);
  assert.match(indexFile, /listAvailableMemoryForAgent/);
  assert.match(indexFile, /ensureDefaultAgentContextPolicy/);
});

test("Index exports memory lifecycle helpers", () => {
  assert.match(indexFile, /markMemoryStale/);
  assert.match(indexFile, /expireMemory/);
  assert.match(indexFile, /revokeMemory/);
  assert.match(indexFile, /archiveMemory/);
});

test("Index exports policy helper", () => {
  assert.match(indexFile, /evaluateMemoryPolicy/);
  assert.match(indexFile, /calculateExpiration/);
  assert.match(indexFile, /isSensitivityAllowed/);
});

// ─── Registry structure ───────────────────────────────────────────────────────

test("Registry exports createAgentContextPolicy", () => {
  assert.match(memoryRegistry, /createAgentContextPolicy/);
});

test("Registry exports upsertAgentContextPolicy", () => {
  assert.match(memoryRegistry, /upsertAgentContextPolicy/);
});

test("Registry exports getAgentContextPolicyByKey", () => {
  assert.match(memoryRegistry, /getAgentContextPolicyByKey/);
});

test("Registry exports createAgentMemory", () => {
  assert.match(memoryRegistry, /createAgentMemory/);
});

test("Registry exports recordAgentMemoryEvent", () => {
  assert.match(memoryRegistry, /recordAgentMemoryEvent/);
});

test("Registry maps snake_case DB columns to camelCase", () => {
  assert.match(memoryRegistry, /workspace_id.*workspaceId|workspaceId.*workspace_id/s);
  assert.match(memoryRegistry, /memory_kind.*memoryKind|memoryKind.*memory_kind/s);
});

// ─── Service structure ────────────────────────────────────────────────────────

test("Service exports ensureDefaultAgentContextPolicy", () => {
  assert.match(memoryService, /ensureDefaultAgentContextPolicy/);
});

test("Service default policy uses policyKey default_agent_context_policy", () => {
  assert.match(memoryService, /default_agent_context_policy/);
});

test("Service createGovernedAgentMemory validates then evaluates policy", () => {
  assert.match(memoryService, /normalizeCreateAgentMemoryInput/);
  assert.match(memoryService, /evaluateMemoryPolicy/);
});

test("Service createGovernedAgentMemory records memory_created event", () => {
  assert.match(memoryService, /memory_created/);
});

test("Service createGovernedAgentMemory records memory_policy_evaluated event", () => {
  assert.match(memoryService, /memory_policy_evaluated/);
});

test("Service checkAgentMemoryAccess returns expired state", () => {
  assert.match(memoryService, /memory_expired/);
});

test("Service checkAgentMemoryAccess returns revoked state", () => {
  assert.match(memoryService, /memory_revoked/);
});

test("Service checkAgentMemoryAccess returns stale state", () => {
  assert.match(memoryService, /memory_stale/);
});

test("Service markMemoryStale records memory_marked_stale event", () => {
  assert.match(memoryService, /memory_marked_stale/);
});

test("Service expireMemory records memory_expired event", () => {
  assert.match(memoryService, /memory_expired/);
});

test("Service revokeMemory records memory_revoked event", () => {
  assert.match(memoryService, /memory_revoked/);
});

test("Service archiveMemory records memory_archived event", () => {
  assert.match(memoryService, /memory_archived/);
});

test("Service does not call LLMs or embeddings", () => {
  assert.equal(memoryService.includes("openai"), false);
  assert.equal(memoryService.includes("anthropic"), false);
  assert.equal(memoryService.includes("embedding"), false);
  assert.equal(memoryService.includes("vector"), false);
});

// ─── API routes structure ─────────────────────────────────────────────────────

test("POST /api/agents/memory route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/route.ts"));
});

test("GET /api/agents/memory/[memoryId] route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/route.ts"));
});

test("POST /api/agents/memory/[memoryId]/access route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/access/route.ts"));
});

test("POST /api/agents/memory/[memoryId]/stale route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/stale/route.ts"));
});

test("POST /api/agents/memory/[memoryId]/expire route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/expire/route.ts"));
});

test("POST /api/agents/memory/[memoryId]/revoke route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/revoke/route.ts"));
});

test("POST /api/agents/memory/[memoryId]/archive route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/archive/route.ts"));
});

test("GET /api/agents/memory/[memoryId]/events route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/memory/[memoryId]/events/route.ts"));
});

test("POST /api/agents/context-policies/defaults route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/context-policies/defaults/route.ts"));
});

test("GET /api/agents/context-policies route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/context-policies/route.ts"));
});

test("GET /api/agents/context-policies/[policyKey] route exists", () => {
  assert.ok(fs.existsSync("src/app/api/agents/context-policies/[policyKey]/route.ts"));
});

// ─── Documentation ────────────────────────────────────────────────────────────

test("Documentation file exists", () => {
  assert.ok(fs.existsSync("docs/agent-memory-context-layer.md"));
});

test("Documentation states no LLM calls", () => {
  const doc = fs.readFileSync("docs/agent-memory-context-layer.md", "utf8");
  assert.match(doc, /does not call LLMs|no LLM/i);
});

// ─── Regression: previous layers not broken ───────────────────────────────────

test("Agent Tool Registry files still exist", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-types.ts"));
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-registry.ts"));
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-service.ts"));
});

test("Agent Permission & Approval Layer files still exist", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-approval-types.ts"));
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-approval-registry.ts"));
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-approval-service.ts"));
});

test("Previous migrations still exist", () => {
  assert.ok(fs.existsSync("supabase/migrations/20260726000000_agent_tool_registry.sql"));
  assert.ok(fs.existsSync("supabase/migrations/20260727000000_agent_permission_approval_layer.sql"));
});
