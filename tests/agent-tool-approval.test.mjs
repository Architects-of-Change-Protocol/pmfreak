import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Load source files ────────────────────────────────────────────────────────

const approvalTypes = fs.readFileSync("src/lib/agents/agent-tool-approval-types.ts", "utf8");
const approvalValidation = fs.readFileSync("src/lib/agents/agent-tool-approval-validation.ts", "utf8");
const approvalPolicy = fs.readFileSync("src/lib/agents/agent-tool-approval-policy.ts", "utf8");
const approvalRegistry = fs.readFileSync("src/lib/agents/agent-tool-approval-registry.ts", "utf8");
const approvalService = fs.readFileSync("src/lib/agents/agent-tool-approval-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260727000000_agent_permission_approval_layer.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/agents/index.ts", "utf8");

// ─── Pure module imports ──────────────────────────────────────────────────────

const {
  detectSensitivePayloadKeys,
  validateRequestContext,
  validateCreateAgentToolRequestInput,
  validateDecideAgentToolApprovalInput,
  isValidApprovalDecision,
} = await import("../src/lib/agents/agent-tool-approval-validation.ts");

const { requiresApprovalForTool } = await import("../src/lib/agents/agent-tool-approval-policy.ts");

// ─── Type definitions ─────────────────────────────────────────────────────────

test("AgentToolRequestStatus contains all required values", () => {
  const required = ["pending", "approved", "rejected", "cancelled", "expired"];
  for (const v of required) {
    assert.ok(approvalTypes.includes(`"${v}"`), `Missing status: ${v}`);
  }
});

test("AgentToolApprovalDecision contains approved and rejected", () => {
  assert.match(approvalTypes, /"approved"/);
  assert.match(approvalTypes, /"rejected"/);
});

test("AgentToolApprovalEventType contains all event types", () => {
  const required = [
    "request_created", "request_approved", "request_rejected",
    "request_cancelled", "request_expired", "approval_revoked",
  ];
  for (const v of required) {
    assert.ok(approvalTypes.includes(`"${v}"`), `Missing event type: ${v}`);
  }
});

test("AgentToolAuthorizationState contains all states", () => {
  const required = ["authorized", "pending", "rejected", "revoked", "not_requested", "expired"];
  for (const v of required) {
    assert.ok(approvalTypes.includes(`"${v}"`), `Missing auth state: ${v}`);
  }
});

test("AgentToolRequestRecord has all required fields", () => {
  const fields = [
    "id", "workspaceId", "agentId", "agentType", "toolId", "toolKey", "status",
    "requestReason", "requestContext", "requestedBy", "requestedAt",
    "expiresAt", "resolvedAt", "createdAt", "updatedAt",
  ];
  for (const f of fields) {
    assert.ok(approvalTypes.includes(f), `AgentToolRequestRecord missing field: ${f}`);
  }
});

test("AgentToolApprovalRecord has all required fields", () => {
  const fields = [
    "id", "requestId", "workspaceId", "decision", "decidedBy", "decisionNote",
    "decidedAt", "revokedAt", "revokedBy", "revocationNote", "createdAt", "updatedAt",
  ];
  for (const f of fields) {
    assert.ok(approvalTypes.includes(f), `AgentToolApprovalRecord missing field: ${f}`);
  }
});

test("AgentToolApprovalEventRecord has all required fields", () => {
  const fields = [
    "id", "requestId", "workspaceId", "eventType", "actor", "note", "metadata", "createdAt",
  ];
  for (const f of fields) {
    assert.ok(approvalTypes.includes(f), `AgentToolApprovalEventRecord missing field: ${f}`);
  }
});

test("AgentToolAuthorizationResult has all required fields", () => {
  const fields = [
    "state", "requestId", "approvalId", "toolKey", "agentId",
    "decidedBy", "decidedAt", "revokedAt",
  ];
  for (const f of fields) {
    assert.ok(approvalTypes.includes(f), `AgentToolAuthorizationResult missing field: ${f}`);
  }
});

// ─── Sensitive payload guard ──────────────────────────────────────────────────

test("detectSensitivePayloadKeys: no sensitive keys returns empty array", () => {
  const result = detectSensitivePayloadKeys({ foo: "bar", count: 1 });
  assert.deepEqual(result, []);
});

test("detectSensitivePayloadKeys: detects password key", () => {
  const result = detectSensitivePayloadKeys({ password: "secret123" });
  assert.ok(result.includes("password"), "Should detect 'password'");
});

test("detectSensitivePayloadKeys: detects token key", () => {
  const result = detectSensitivePayloadKeys({ token: "abc" });
  assert.ok(result.includes("token"));
});

test("detectSensitivePayloadKeys: detects apiKey key", () => {
  const result = detectSensitivePayloadKeys({ apiKey: "xyz" });
  assert.ok(result.includes("apiKey"));
});

test("detectSensitivePayloadKeys: detects api_key key", () => {
  const result = detectSensitivePayloadKeys({ api_key: "xyz" });
  assert.ok(result.includes("api_key"));
});

test("detectSensitivePayloadKeys: detects secret key", () => {
  const result = detectSensitivePayloadKeys({ secret: "value" });
  assert.ok(result.includes("secret"));
});

test("detectSensitivePayloadKeys: detects authorization key", () => {
  const result = detectSensitivePayloadKeys({ authorization: "Bearer x" });
  assert.ok(result.includes("authorization"));
});

test("detectSensitivePayloadKeys: detects stripe_secret key", () => {
  const result = detectSensitivePayloadKeys({ stripe_secret: "sk_live_xxx" });
  assert.ok(result.includes("stripe_secret"));
});

test("detectSensitivePayloadKeys: detects private_key key", () => {
  const result = detectSensitivePayloadKeys({ private_key: "-----BEGIN RSA" });
  assert.ok(result.includes("private_key"));
});

test("detectSensitivePayloadKeys: detects nested sensitive keys", () => {
  const result = detectSensitivePayloadKeys({ nested: { password: "x" } });
  assert.ok(result.some((k) => k.includes("password")));
});

test("validateRequestContext: clean context passes", () => {
  assert.equal(validateRequestContext({ projectId: "p1", reason: "analysis" }), null);
});

test("validateRequestContext: context with password fails", () => {
  const err = validateRequestContext({ password: "oops" });
  assert.notEqual(err, null);
  assert.ok(err?.includes("password"));
});

// ─── Request input validation ─────────────────────────────────────────────────

test("validateCreateAgentToolRequestInput: valid input passes", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "ws-1",
    agentId: "agent-1",
    agentType: "copilot",
    toolKey: "draft_client_email",
  });
  assert.equal(result, null);
});

test("validateCreateAgentToolRequestInput: missing workspaceId fails", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "",
    agentId: "agent-1",
    agentType: "copilot",
    toolKey: "draft_client_email",
  });
  assert.notEqual(result, null);
});

test("validateCreateAgentToolRequestInput: missing agentId fails", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "ws-1",
    agentId: "",
    agentType: "copilot",
    toolKey: "draft_client_email",
  });
  assert.notEqual(result, null);
});

test("validateCreateAgentToolRequestInput: missing toolKey fails", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "ws-1",
    agentId: "agent-1",
    agentType: "copilot",
    toolKey: "",
  });
  assert.notEqual(result, null);
});

test("validateCreateAgentToolRequestInput: sensitive payload context fails", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "ws-1",
    agentId: "agent-1",
    agentType: "copilot",
    toolKey: "draft_client_email",
    requestContext: { password: "oops" },
  });
  assert.notEqual(result, null);
  assert.ok(result?.includes("password"));
});

test("validateCreateAgentToolRequestInput: past expiresAt fails", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "ws-1",
    agentId: "agent-1",
    agentType: "copilot",
    toolKey: "draft_client_email",
    expiresAt: "2020-01-01T00:00:00Z",
  });
  assert.notEqual(result, null);
});

test("validateCreateAgentToolRequestInput: future expiresAt passes", () => {
  const result = validateCreateAgentToolRequestInput({
    workspaceId: "ws-1",
    agentId: "agent-1",
    agentType: "copilot",
    toolKey: "draft_client_email",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  assert.equal(result, null);
});

// ─── Decision input validation ────────────────────────────────────────────────

test("validateDecideAgentToolApprovalInput: valid approved input passes", () => {
  const result = validateDecideAgentToolApprovalInput({
    requestId: "req-1",
    workspaceId: "ws-1",
    decision: "approved",
    decidedBy: "user-1",
  });
  assert.equal(result, null);
});

test("validateDecideAgentToolApprovalInput: valid rejected input passes", () => {
  const result = validateDecideAgentToolApprovalInput({
    requestId: "req-1",
    workspaceId: "ws-1",
    decision: "rejected",
    decidedBy: "user-1",
    decisionNote: "Not needed.",
  });
  assert.equal(result, null);
});

test("validateDecideAgentToolApprovalInput: missing requestId fails", () => {
  const result = validateDecideAgentToolApprovalInput({
    requestId: "",
    workspaceId: "ws-1",
    decision: "approved",
    decidedBy: "user-1",
  });
  assert.notEqual(result, null);
});

test("validateDecideAgentToolApprovalInput: invalid decision fails", () => {
  const result = validateDecideAgentToolApprovalInput({
    requestId: "req-1",
    workspaceId: "ws-1",
    decision: "maybe",
    decidedBy: "user-1",
  });
  assert.notEqual(result, null);
});

test("isValidApprovalDecision: approved is valid", () => {
  assert.equal(isValidApprovalDecision("approved"), true);
});

test("isValidApprovalDecision: rejected is valid", () => {
  assert.equal(isValidApprovalDecision("rejected"), true);
});

test("isValidApprovalDecision: pending is not a valid decision", () => {
  assert.equal(isValidApprovalDecision("pending"), false);
});

// ─── Policy ───────────────────────────────────────────────────────────────────

function makeTool(overrides = {}) {
  return {
    id: "tool-1",
    workspaceId: "ws-1",
    toolKey: "some_tool",
    displayName: "Some Tool",
    description: "A tool",
    category: "analysis",
    riskLevel: "low",
    executionMode: "read_only",
    status: "active",
    inputSchema: null,
    outputSchema: null,
    requiredPermissions: [],
    compatibleAgentTypes: [],
    createsEvidence: false,
    mutatesState: false,
    requiresHumanApproval: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("requiresApprovalForTool: low-risk read-only tool does not require approval", () => {
  const result = requiresApprovalForTool(makeTool());
  assert.equal(result.required, false);
  assert.equal(result.reason, null);
});

test("requiresApprovalForTool: requiresHumanApproval=true triggers approval", () => {
  const result = requiresApprovalForTool(makeTool({ requiresHumanApproval: true }));
  assert.equal(result.required, true);
  assert.ok(result.reason?.includes("explicitly"));
});

test("requiresApprovalForTool: executionMode=requires_approval triggers approval", () => {
  const result = requiresApprovalForTool(makeTool({ executionMode: "requires_approval" }));
  assert.equal(result.required, true);
  assert.ok(result.reason?.includes("requires_approval"));
});

test("requiresApprovalForTool: critical risk level triggers approval", () => {
  const result = requiresApprovalForTool(makeTool({ riskLevel: "critical" }));
  assert.equal(result.required, true);
  assert.ok(result.reason?.includes("critical"));
});

test("requiresApprovalForTool: high risk + mutatesState triggers approval", () => {
  const result = requiresApprovalForTool(makeTool({ riskLevel: "high", mutatesState: true }));
  assert.equal(result.required, true);
  assert.ok(result.reason?.includes("high-risk"));
});

test("requiresApprovalForTool: high risk without mutatesState does NOT trigger approval", () => {
  const result = requiresApprovalForTool(makeTool({ riskLevel: "high", mutatesState: false }));
  assert.equal(result.required, false);
});

test("requiresApprovalForTool: medium risk tool does not require approval", () => {
  const result = requiresApprovalForTool(makeTool({ riskLevel: "medium" }));
  assert.equal(result.required, false);
});

// ─── Registry source checks ───────────────────────────────────────────────────

test("registry exports createAgentToolRequest", () => {
  assert.match(approvalRegistry, /export async function createAgentToolRequest/);
});

test("registry exports getAgentToolRequestById", () => {
  assert.match(approvalRegistry, /export async function getAgentToolRequestById/);
});

test("registry exports listAgentToolRequests", () => {
  assert.match(approvalRegistry, /export async function listAgentToolRequests/);
});

test("registry exports updateAgentToolRequestStatus", () => {
  assert.match(approvalRegistry, /export async function updateAgentToolRequestStatus/);
});

test("registry exports recordAgentToolApproval", () => {
  assert.match(approvalRegistry, /export async function recordAgentToolApproval/);
});

test("registry exports listApprovalsForRequest", () => {
  assert.match(approvalRegistry, /export async function listApprovalsForRequest/);
});

test("registry exports recordAgentToolApprovalEvent", () => {
  assert.match(approvalRegistry, /export async function recordAgentToolApprovalEvent/);
});

test("registry exports listApprovalEventsForRequest", () => {
  assert.match(approvalRegistry, /export async function listApprovalEventsForRequest/);
});

// ─── Service source checks ────────────────────────────────────────────────────

test("service exports requestAgentToolAuthorization", () => {
  assert.match(approvalService, /export async function requestAgentToolAuthorization/);
});

test("service exports decideAgentToolApproval", () => {
  assert.match(approvalService, /export async function decideAgentToolApproval/);
});

test("service exports getAgentToolAuthorizationState", () => {
  assert.match(approvalService, /export async function getAgentToolAuthorizationState/);
});

test("service exports cancelAgentToolRequest", () => {
  assert.match(approvalService, /export async function cancelAgentToolRequest/);
});

test("service exports revokeAgentToolApproval", () => {
  assert.match(approvalService, /export async function revokeAgentToolApproval/);
});

test("service calls checkAgentToolEligibility with allowApprovalRequiredTools: true", () => {
  assert.match(approvalService, /allowApprovalRequiredTools.*true/s);
});

// ─── Authorization state simulation ──────────────────────────────────────────

// Pure in-memory simulation of authorization state logic
function computeAuthorizationState(requests, approvals, toolKey, agentId) {
  if (!requests || requests.length === 0) {
    return { state: "not_requested", requestId: null, approvalId: null };
  }

  const active = requests.find((r) => r.status !== "cancelled");
  if (!active) return { state: "not_requested", requestId: null, approvalId: null };

  if (active.status === "pending") {
    if (active.expiresAt && new Date(active.expiresAt) <= new Date()) {
      return { state: "expired", requestId: active.id, approvalId: null };
    }
    return { state: "pending", requestId: active.id, approvalId: null };
  }
  if (active.status === "rejected") {
    const rej = (approvals[active.id] || []).find((a) => a.decision === "rejected");
    return { state: "rejected", requestId: active.id, approvalId: rej?.id ?? null };
  }
  if (active.status === "expired") {
    return { state: "expired", requestId: active.id, approvalId: null };
  }
  if (active.status === "approved") {
    const aprs = approvals[active.id] || [];
    const apr = aprs.find((a) => a.decision === "approved");
    if (apr?.revokedAt) {
      return { state: "revoked", requestId: active.id, approvalId: apr.id };
    }
    return { state: "authorized", requestId: active.id, approvalId: apr?.id ?? null };
  }
  return { state: "not_requested", requestId: null, approvalId: null };
}

test("auth state: no requests → not_requested", () => {
  const r = computeAuthorizationState([], {}, "tool", "agent");
  assert.equal(r.state, "not_requested");
});

test("auth state: pending request → pending", () => {
  const requests = [{ id: "r1", status: "pending", expiresAt: null }];
  const r = computeAuthorizationState(requests, {}, "tool", "agent");
  assert.equal(r.state, "pending");
  assert.equal(r.requestId, "r1");
});

test("auth state: pending but expired → expired", () => {
  const requests = [{ id: "r1", status: "pending", expiresAt: "2020-01-01T00:00:00Z" }];
  const r = computeAuthorizationState(requests, {}, "tool", "agent");
  assert.equal(r.state, "expired");
});

test("auth state: approved request → authorized", () => {
  const requests = [{ id: "r1", status: "approved", expiresAt: null }];
  const approvals = { r1: [{ id: "a1", decision: "approved", revokedAt: null }] };
  const r = computeAuthorizationState(requests, approvals, "tool", "agent");
  assert.equal(r.state, "authorized");
  assert.equal(r.approvalId, "a1");
});

test("auth state: approved then revoked → revoked", () => {
  const requests = [{ id: "r1", status: "approved", expiresAt: null }];
  const approvals = {
    r1: [{ id: "a1", decision: "approved", revokedAt: "2026-01-01T00:00:00Z" }],
  };
  const r = computeAuthorizationState(requests, approvals, "tool", "agent");
  assert.equal(r.state, "revoked");
});

test("auth state: rejected request → rejected", () => {
  const requests = [{ id: "r1", status: "rejected", expiresAt: null }];
  const approvals = { r1: [{ id: "a1", decision: "rejected", revokedAt: null }] };
  const r = computeAuthorizationState(requests, approvals, "tool", "agent");
  assert.equal(r.state, "rejected");
});

test("auth state: only cancelled requests → not_requested", () => {
  const requests = [{ id: "r1", status: "cancelled", expiresAt: null }];
  const r = computeAuthorizationState(requests, {}, "tool", "agent");
  assert.equal(r.state, "not_requested");
});

// ─── Migration checks ─────────────────────────────────────────────────────────

test("migration creates agent_tool_requests table", () => {
  assert.match(migration, /create table if not exists public\.agent_tool_requests/);
});

test("migration creates agent_tool_approvals table", () => {
  assert.match(migration, /create table if not exists public\.agent_tool_approvals/);
});

test("migration creates agent_tool_approval_events table", () => {
  assert.match(migration, /create table if not exists public\.agent_tool_approval_events/);
});

test("migration has correct status check constraint", () => {
  assert.match(migration, /pending.*approved.*rejected.*cancelled.*expired/s);
});

test("migration has correct decision check constraint", () => {
  assert.match(migration, /decision.*check.*approved.*rejected/s);
});

test("migration has correct event_type check constraint", () => {
  assert.match(migration, /request_created.*request_approved.*request_rejected/s);
});

test("migration enables RLS on all three tables", () => {
  const count = (migration.match(/enable row level security/g) || []).length;
  assert.ok(count >= 3, `Expected at least 3 RLS enables, got ${count}`);
});

test("migration wraps in transaction", () => {
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;/);
});

test("migration creates indexes for agent_tool_requests", () => {
  assert.match(migration, /create index if not exists agent_tool_requests_workspace_idx/);
});

test("migration creates indexes for agent_tool_approvals", () => {
  assert.match(migration, /create index if not exists agent_tool_approvals_request_idx/);
});

test("migration creates indexes for agent_tool_approval_events", () => {
  assert.match(migration, /create index if not exists agent_tool_approval_events_request_idx/);
});

// ─── Database contract checks ─────────────────────────────────────────────────

test("database contract includes AgentToolRequestRow", () => {
  assert.match(contract, /AgentToolRequestRow/);
});

test("database contract includes AGENT_TOOL_REQUEST_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /AGENT_TOOL_REQUEST_SELECTABLE_COLUMNS/);
});

test("database contract includes AgentToolApprovalRow", () => {
  assert.match(contract, /AgentToolApprovalRow/);
});

test("database contract includes AGENT_TOOL_APPROVAL_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /AGENT_TOOL_APPROVAL_SELECTABLE_COLUMNS/);
});

test("database contract includes AgentToolApprovalEventRow", () => {
  assert.match(contract, /AgentToolApprovalEventRow/);
});

test("database contract includes AGENT_TOOL_APPROVAL_EVENT_SELECTABLE_COLUMNS", () => {
  assert.match(contract, /AGENT_TOOL_APPROVAL_EVENT_SELECTABLE_COLUMNS/);
});

test("database contract version includes agent-permission-approval-layer", () => {
  assert.match(contract, /agent-permission-approval-layer/);
});

// ─── Index / barrel exports ───────────────────────────────────────────────────

test("index exports all approval type symbols", () => {
  const expected = [
    "AgentToolRequestStatus", "AgentToolApprovalDecision", "AgentToolApprovalEventType",
    "AgentToolAuthorizationState", "AgentToolRequestRecord", "AgentToolApprovalRecord",
    "AgentToolApprovalEventRecord", "CreateAgentToolRequestInput", "DecideAgentToolApprovalInput",
    "AgentToolAuthorizationResult", "AgentToolRequestListFilters",
  ];
  for (const sym of expected) {
    assert.ok(indexFile.includes(sym), `index.ts missing type export: ${sym}`);
  }
});

test("index exports all approval service functions", () => {
  const expected = [
    "requestAgentToolAuthorization", "decideAgentToolApproval",
    "getAgentToolAuthorizationState", "cancelAgentToolRequest", "revokeAgentToolApproval",
  ];
  for (const sym of expected) {
    assert.ok(indexFile.includes(sym), `index.ts missing export: ${sym}`);
  }
});

test("index exports all approval validation functions", () => {
  const expected = [
    "detectSensitivePayloadKeys", "validateRequestContext",
    "validateCreateAgentToolRequestInput", "validateDecideAgentToolApprovalInput",
    "isValidApprovalDecision",
  ];
  for (const sym of expected) {
    assert.ok(indexFile.includes(sym), `index.ts missing export: ${sym}`);
  }
});

test("index exports requiresApprovalForTool", () => {
  assert.ok(indexFile.includes("requiresApprovalForTool"), "index.ts missing requiresApprovalForTool");
});

// ─── API route existence checks ───────────────────────────────────────────────

test("POST /api/agents/tool-requests route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/route.ts");
  assert.ok(exists, "tool-requests/route.ts not found");
});

test("GET /api/agents/tool-requests/[requestId] route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/[requestId]/route.ts");
  assert.ok(exists);
});

test("POST /api/agents/tool-requests/[requestId]/approve route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/[requestId]/approve/route.ts");
  assert.ok(exists);
});

test("POST /api/agents/tool-requests/[requestId]/reject route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/[requestId]/reject/route.ts");
  assert.ok(exists);
});

test("POST /api/agents/tool-requests/[requestId]/cancel route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/[requestId]/cancel/route.ts");
  assert.ok(exists);
});

test("POST /api/agents/tool-requests/[requestId]/revoke route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/[requestId]/revoke/route.ts");
  assert.ok(exists);
});

test("GET /api/agents/tool-requests/[requestId]/events route exists", () => {
  const exists = fs.existsSync("src/app/api/agents/tool-requests/[requestId]/events/route.ts");
  assert.ok(exists);
});

test("approve route requires admin role", () => {
  const src = fs.readFileSync("src/app/api/agents/tool-requests/[requestId]/approve/route.ts", "utf8");
  assert.match(src, /requireWorkspaceRole/);
  assert.match(src, /admin/);
});

test("reject route requires admin role", () => {
  const src = fs.readFileSync("src/app/api/agents/tool-requests/[requestId]/reject/route.ts", "utf8");
  assert.match(src, /requireWorkspaceRole/);
  assert.match(src, /admin/);
});

test("revoke route requires admin role", () => {
  const src = fs.readFileSync("src/app/api/agents/tool-requests/[requestId]/revoke/route.ts", "utf8");
  assert.match(src, /requireWorkspaceRole/);
  assert.match(src, /admin/);
});

test("cancel route requires workspace member", () => {
  const src = fs.readFileSync("src/app/api/agents/tool-requests/[requestId]/cancel/route.ts", "utf8");
  assert.match(src, /requireWorkspaceMember/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test("documentation file exists", () => {
  const exists = fs.existsSync("docs/agent-permission-approval-layer.md");
  assert.ok(exists, "docs/agent-permission-approval-layer.md not found");
});
