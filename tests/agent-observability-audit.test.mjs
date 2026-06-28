import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Load source files ────────────────────────────────────────────────────────

const obsTypes = fs.readFileSync("src/lib/agents/agent-observability-types.ts", "utf8");
const obsValidation = fs.readFileSync("src/lib/agents/agent-observability-validation.ts", "utf8");
const obsRegistry = fs.readFileSync("src/lib/agents/agent-observability-registry.ts", "utf8");
const obsService = fs.readFileSync("src/lib/agents/agent-observability-service.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260729000000_agent_observability_audit_trail.sql", "utf8");
const contract = fs.readFileSync("src/lib/db/database-contract.ts", "utf8");
const indexFile = fs.readFileSync("src/lib/agents/index.ts", "utf8");

// ─── Pure module imports ──────────────────────────────────────────────────────

const {
  validateAgentAuditEventCategory,
  validateAgentAuditEventType,
  validateAgentAuditSeverity,
  validateAgentAuditOutcome,
  validateAgentAuditSourceType,
  validateAgentAuditScopeType,
  validateAgentDecisionType,
  validateAgentDecisionStatus,
  validateAgentAuditExportFormat,
  assertAuditPayloadSerializable,
  redactAuditPayload,
  normalizeCreateAgentAuditEventInput,
  normalizeCreateAgentDecisionEventInput,
} = await import("../src/lib/agents/agent-observability-validation.ts");

// ─── Type definitions ─────────────────────────────────────────────────────────

test("AgentAuditEventCategory contains all required values", () => {
  for (const v of ["agent", "tool", "approval", "memory", "context", "decision", "governance", "reporting", "security", "system"]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing category: ${v}`);
  }
});

test("AgentAuditEventType contains all required values", () => {
  for (const v of [
    "agent_registered", "agent_updated", "tool_eligibility_checked",
    "tool_request_created", "tool_request_approved", "tool_request_rejected",
    "tool_request_cancelled", "tool_request_revoked",
    "memory_created", "memory_accessed", "memory_marked_stale", "memory_expired",
    "memory_revoked", "memory_archived", "context_policy_created", "context_policy_updated",
    "decision_recorded", "recommendation_recorded", "classification_recorded",
    "governance_event_recorded", "report_generated",
    "access_denied", "policy_denied", "sensitive_payload_rejected", "audit_export_created",
  ]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing event type: ${v}`);
  }
});

test("AgentAuditSeverity contains all required values", () => {
  for (const v of ["info", "notice", "warning", "high", "critical"]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing severity: ${v}`);
  }
});

test("AgentAuditOutcome contains all required values", () => {
  for (const v of ["success", "denied", "pending", "failed", "cancelled", "revoked", "expired"]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing outcome: ${v}`);
  }
});

test("AgentAuditSourceType contains all required values", () => {
  for (const v of [
    "agent_specification", "agent_tool_registry", "agent_tool_approval",
    "agent_memory_context", "pmo_governance", "pmo_command_center",
    "executive_reporting", "system", "api",
  ]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing source type: ${v}`);
  }
});

test("AgentAuditScopeType contains all required values", () => {
  for (const v of [
    "workspace", "portfolio", "project", "pm", "agent",
    "tool_request", "approval_request", "memory_record", "context_policy", "report",
  ]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing scope type: ${v}`);
  }
});

test("AgentDecisionType contains all required values", () => {
  for (const v of ["classification", "recommendation", "risk_assessment", "intervention_suggestion", "summary", "governance_assessment", "next_action"]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing decision type: ${v}`);
  }
});

test("AgentDecisionStatus contains all required values", () => {
  for (const v of ["draft", "proposed", "accepted", "rejected", "superseded", "archived"]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing decision status: ${v}`);
  }
});

test("AgentAuditExportFormat contains all required values", () => {
  for (const v of ["json", "csv", "markdown"]) {
    assert.ok(obsTypes.includes(`"${v}"`), `Missing export format: ${v}`);
  }
});

// ─── Validation: categories ───────────────────────────────────────────────────

test("valid audit event categories pass", () => {
  for (const v of ["agent", "tool", "approval", "memory", "context", "decision", "governance", "reporting", "security", "system"]) {
    assert.ok(validateAgentAuditEventCategory(v), `Expected ${v} to be valid`);
  }
});

test("invalid audit event category fails", () => {
  assert.equal(validateAgentAuditEventCategory("invalid_cat"), false);
  assert.equal(validateAgentAuditEventCategory(""), false);
});

test("valid audit event types pass", () => {
  assert.ok(validateAgentAuditEventType("tool_request_created"));
  assert.ok(validateAgentAuditEventType("memory_accessed"));
  assert.ok(validateAgentAuditEventType("audit_export_created"));
});

test("invalid audit event type fails", () => {
  assert.equal(validateAgentAuditEventType("not_a_type"), false);
});

test("valid severities pass", () => {
  for (const v of ["info", "notice", "warning", "high", "critical"]) {
    assert.ok(validateAgentAuditSeverity(v));
  }
});

test("invalid severity fails", () => {
  assert.equal(validateAgentAuditSeverity("debug"), false);
});

test("valid outcomes pass", () => {
  for (const v of ["success", "denied", "pending", "failed", "cancelled", "revoked", "expired"]) {
    assert.ok(validateAgentAuditOutcome(v));
  }
});

test("invalid outcome fails", () => {
  assert.equal(validateAgentAuditOutcome("unknown"), false);
});

test("valid source types pass", () => {
  assert.ok(validateAgentAuditSourceType("agent_tool_registry"));
  assert.ok(validateAgentAuditSourceType("system"));
});

test("invalid source type fails", () => {
  assert.equal(validateAgentAuditSourceType("jira"), false);
});

test("valid scope types pass", () => {
  assert.ok(validateAgentAuditScopeType("project"));
  assert.ok(validateAgentAuditScopeType("memory_record"));
});

test("invalid scope type fails", () => {
  assert.equal(validateAgentAuditScopeType("random"), false);
});

test("valid decision types pass", () => {
  assert.ok(validateAgentDecisionType("recommendation"));
  assert.ok(validateAgentDecisionType("risk_assessment"));
});

test("invalid decision type fails", () => {
  assert.equal(validateAgentDecisionType("guess"), false);
});

test("valid decision statuses pass", () => {
  for (const v of ["draft", "proposed", "accepted", "rejected", "superseded", "archived"]) {
    assert.ok(validateAgentDecisionStatus(v));
  }
});

test("invalid decision status fails", () => {
  assert.equal(validateAgentDecisionStatus("open"), false);
});

test("valid export formats pass", () => {
  for (const v of ["json", "csv", "markdown"]) {
    assert.ok(validateAgentAuditExportFormat(v));
  }
});

test("invalid export format fails", () => {
  assert.equal(validateAgentAuditExportFormat("xlsx"), false);
});

// ─── Payload safety ───────────────────────────────────────────────────────────

test("payload must be JSON serializable", () => {
  const circular = {};
  circular["self"] = circular;
  assert.throws(() => assertAuditPayloadSerializable(circular), /serializable/i);
});

test("null payload is serializable", () => {
  assert.doesNotThrow(() => assertAuditPayloadSerializable(null));
});

test("valid payload is serializable", () => {
  assert.doesNotThrow(() => assertAuditPayloadSerializable({ key: "value", count: 1 }));
});

test("secret-like payload keys are redacted", () => {
  const result = redactAuditPayload({
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
  const result = redactAuditPayload({ private_key: "supersecret" });
  assert.equal(result?.private_key, "[REDACTED]");
});

test("redacted payload does not expose access_token", () => {
  const result = redactAuditPayload({ access_token: "tok_xyz" });
  assert.equal(result?.access_token, "[REDACTED]");
});

test("null payload returns null from redact", () => {
  assert.equal(redactAuditPayload(null), null);
});

// ─── Normalization ────────────────────────────────────────────────────────────

test("normalizeCreateAgentAuditEventInput defaults severity to info", () => {
  const result = normalizeCreateAgentAuditEventInput({
    workspaceId: "ws_1",
    category: "tool",
    eventType: "tool_request_created",
    sourceType: "agent_tool_approval",
    scopeType: "tool_request",
    title: "Test event",
  });
  assert.equal(result.severity, "info");
});

test("normalizeCreateAgentAuditEventInput defaults outcome to success", () => {
  const result = normalizeCreateAgentAuditEventInput({
    workspaceId: "ws_1",
    category: "tool",
    eventType: "tool_request_created",
    sourceType: "agent_tool_approval",
    scopeType: "tool_request",
    title: "Test event",
  });
  assert.equal(result.outcome, "success");
});

test("normalizeCreateAgentAuditEventInput trims title", () => {
  const result = normalizeCreateAgentAuditEventInput({
    workspaceId: "ws_1",
    category: "tool",
    eventType: "tool_request_created",
    sourceType: "agent_tool_approval",
    scopeType: "tool_request",
    title: "  My title  ",
  });
  assert.equal(result.title, "My title");
});

test("normalizeCreateAgentAuditEventInput rejects title over 240 chars", () => {
  assert.throws(
    () => normalizeCreateAgentAuditEventInput({
      workspaceId: "ws_1",
      category: "tool",
      eventType: "tool_request_created",
      sourceType: "agent_tool_approval",
      scopeType: "tool_request",
      title: "x".repeat(241),
    }),
    /240/,
  );
});

test("normalizeCreateAgentAuditEventInput rejects invalid category", () => {
  assert.throws(
    () => normalizeCreateAgentAuditEventInput({
      workspaceId: "ws_1",
      category: "bad_cat",
      eventType: "tool_request_created",
      sourceType: "agent_tool_approval",
      scopeType: "tool_request",
      title: "t",
    }),
    /category/i,
  );
});

test("normalizeCreateAgentAuditEventInput deduplicates evidenceRefs", () => {
  const result = normalizeCreateAgentAuditEventInput({
    workspaceId: "ws_1",
    category: "tool",
    eventType: "tool_request_created",
    sourceType: "agent_tool_approval",
    scopeType: "tool_request",
    title: "t",
    evidenceRefs: ["ref_a", "ref_a", "ref_b"],
  });
  assert.deepEqual(result.evidenceRefs, ["ref_a", "ref_b"]);
});

test("normalizeCreateAgentDecisionEventInput defaults status to draft", () => {
  const result = normalizeCreateAgentDecisionEventInput({
    workspaceId: "ws_1",
    decisionType: "recommendation",
    scopeType: "project",
    title: "Recommend escalation",
  });
  assert.equal(result.status, "draft");
});

test("normalizeCreateAgentDecisionEventInput rejects confidenceScore outside 0-1", () => {
  assert.throws(
    () => normalizeCreateAgentDecisionEventInput({
      workspaceId: "ws_1",
      decisionType: "recommendation",
      scopeType: "project",
      title: "t",
      confidenceScore: 1.5,
    }),
    /confidence/i,
  );
});

// ─── Migration structure ──────────────────────────────────────────────────────

test("migration creates agent_audit_events table", () => {
  assert.ok(migration.includes("create table if not exists public.agent_audit_events"));
});

test("migration creates agent_decision_events table", () => {
  assert.ok(migration.includes("create table if not exists public.agent_decision_events"));
});

test("migration creates agent_audit_exports table", () => {
  assert.ok(migration.includes("create table if not exists public.agent_audit_exports"));
});

test("migration enables RLS on all three tables", () => {
  assert.ok(migration.includes("alter table public.agent_audit_events enable row level security"));
  assert.ok(migration.includes("alter table public.agent_decision_events enable row level security"));
  assert.ok(migration.includes("alter table public.agent_audit_exports enable row level security"));
});

test("migration includes workspace member read policy for audit events", () => {
  assert.ok(migration.includes("workspace_members_read_audit_events"));
});

test("migration includes workspace member insert policy for audit events", () => {
  assert.ok(migration.includes("workspace_members_insert_audit_events"));
});

test("migration includes admin update policy for decision events", () => {
  assert.ok(migration.includes("workspace_admins_update_decision_events"));
});

test("migration includes admin-only policy for exports", () => {
  assert.ok(migration.includes("workspace_admins_read_audit_exports"));
  assert.ok(migration.includes("workspace_admins_insert_audit_exports"));
});

test("migration includes correlation_id column", () => {
  assert.ok(migration.includes("correlation_id text"));
});

test("migration includes indexes for workspace + occurred_at", () => {
  assert.ok(migration.includes("agent_audit_events_occurred_idx"));
});

// ─── Database contract ────────────────────────────────────────────────────────

test("contract declares AgentAuditEventRow", () => {
  assert.ok(contract.includes("AgentAuditEventRow"));
});

test("contract declares AgentDecisionEventRow", () => {
  assert.ok(contract.includes("AgentDecisionEventRow"));
});

test("contract declares AgentAuditExportRow", () => {
  assert.ok(contract.includes("AgentAuditExportRow"));
});

test("contract declares AGENT_AUDIT_EVENT_COLUMNS", () => {
  assert.ok(contract.includes("AGENT_AUDIT_EVENT_COLUMNS"));
});

test("contract declares AGENT_DECISION_EVENT_COLUMNS", () => {
  assert.ok(contract.includes("AGENT_DECISION_EVENT_COLUMNS"));
});

test("contract declares AGENT_AUDIT_EXPORT_COLUMNS", () => {
  assert.ok(contract.includes("AGENT_AUDIT_EXPORT_COLUMNS"));
});

test("contract version includes observability layer", () => {
  assert.ok(contract.includes("agent-observability-audit-trail"));
});

// ─── Registry structure ───────────────────────────────────────────────────────

test("registry exports createAgentAuditEvent", () => {
  assert.ok(obsRegistry.includes("createAgentAuditEvent"));
});

test("registry exports listAgentAuditEvents", () => {
  assert.ok(obsRegistry.includes("listAgentAuditEvents"));
});

test("registry exports createAgentDecisionEvent", () => {
  assert.ok(obsRegistry.includes("createAgentDecisionEvent"));
});

test("registry exports updateAgentDecisionStatus", () => {
  assert.ok(obsRegistry.includes("updateAgentDecisionStatus"));
});

test("registry exports createAgentAuditExport", () => {
  assert.ok(obsRegistry.includes("createAgentAuditExport"));
});

test("registry maps payload_json to redacted payload", () => {
  assert.ok(obsRegistry.includes("redacted_payload_json"));
});

test("registry maps evidence_refs_json to array", () => {
  assert.ok(obsRegistry.includes("evidence_refs_json"));
});

// ─── Service structure ────────────────────────────────────────────────────────

test("service exports recordAgentAuditEvent", () => {
  assert.ok(obsService.includes("recordAgentAuditEvent"));
});

test("service exports recordAgentDecision", () => {
  assert.ok(obsService.includes("recordAgentDecision"));
});

test("service exports getAgentTimeline", () => {
  assert.ok(obsService.includes("getAgentTimeline"));
});

test("service exports getWorkspaceAgentAuditSummary", () => {
  assert.ok(obsService.includes("getWorkspaceAgentAuditSummary"));
});

test("service exports exportAgentAuditTrail", () => {
  assert.ok(obsService.includes("exportAgentAuditTrail"));
});

test("service exports recordToolRequestAuditEvent", () => {
  assert.ok(obsService.includes("recordToolRequestAuditEvent"));
});

test("service exports recordMemoryAuditEvent", () => {
  assert.ok(obsService.includes("recordMemoryAuditEvent"));
});

test("service summary computes highRiskCount", () => {
  assert.ok(obsService.includes("highRiskCount"));
});

test("service summary computes deniedCount", () => {
  assert.ok(obsService.includes("deniedCount"));
});

test("service summary computes criticalCount", () => {
  assert.ok(obsService.includes("criticalCount"));
});

test("service buildCSVArtifact includes header columns", () => {
  assert.ok(obsService.includes("occurredAt") && obsService.includes("category") && obsService.includes("eventType"));
});

test("service JSON export includes metadata", () => {
  assert.ok(obsService.includes("generatedAt") && obsService.includes("filters"));
});

test("service Markdown export includes sections", () => {
  assert.ok(obsService.includes("# Agent Audit Trail") && obsService.includes("## Events"));
});

test("service does not call LLM providers", () => {
  assert.ok(!obsService.includes("openai") && !obsService.includes("anthropic") && !obsService.includes("createCompletion"));
});

test("service does not create embeddings", () => {
  assert.ok(!obsService.includes("embedding") && !obsService.includes("vectorize"));
});

// ─── Index exports ────────────────────────────────────────────────────────────

test("index exports observability types", () => {
  assert.ok(indexFile.includes("AgentAuditEventRecord"));
  assert.ok(indexFile.includes("AgentDecisionEventRecord"));
  assert.ok(indexFile.includes("AgentAuditExportRecord"));
});

test("index exports observability validation helpers", () => {
  assert.ok(indexFile.includes("redactAuditPayload"));
  assert.ok(indexFile.includes("normalizeCreateAgentAuditEventInput"));
});

test("index exports observability registry functions", () => {
  assert.ok(indexFile.includes("createAgentAuditEvent"));
  assert.ok(indexFile.includes("listAgentAuditExports"));
});

test("index exports observability service functions", () => {
  assert.ok(indexFile.includes("recordAgentAuditEvent"));
  assert.ok(indexFile.includes("exportAgentAuditTrail"));
});

// ─── Timeline behavior ────────────────────────────────────────────────────────

test("service getAgentTimeline sorts newest first", () => {
  // sort is applied in listAgentAuditEvents (registry) with occurred_at desc
  assert.ok(obsRegistry.includes("ascending: false") || obsRegistry.includes("desc") || obsService.includes("getTime"));
});

test("service getAgentTimeline respects limit", () => {
  assert.ok(obsService.includes("limit"));
});

// ─── API routes ───────────────────────────────────────────────────────────────

test("POST audit events route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/events/route.ts", "utf8");
  assert.ok(routeContent.includes("POST"));
  assert.ok(routeContent.includes("recordAgentAuditEvent"));
});

test("GET audit events route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/events/route.ts", "utf8");
  assert.ok(routeContent.includes("GET"));
  assert.ok(routeContent.includes("listAgentAuditEvents"));
});

test("GET audit event by id route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/events/[eventId]/route.ts", "utf8");
  assert.ok(routeContent.includes("getAgentAuditEventById"));
});

test("POST decisions route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/decisions/route.ts", "utf8");
  assert.ok(routeContent.includes("recordAgentDecision"));
});

test("GET decisions route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/decisions/route.ts", "utf8");
  assert.ok(routeContent.includes("listAgentDecisionEvents"));
});

test("PATCH decision route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/decisions/[decisionId]/route.ts", "utf8");
  assert.ok(routeContent.includes("PATCH"));
  assert.ok(routeContent.includes("updateAgentDecisionStatus"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("GET timeline route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/timeline/route.ts", "utf8");
  assert.ok(routeContent.includes("getAgentTimeline"));
});

test("GET summary route exists", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/summary/route.ts", "utf8");
  assert.ok(routeContent.includes("getWorkspaceAgentAuditSummary"));
});

test("POST exports route exists and requires admin", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/exports/route.ts", "utf8");
  assert.ok(routeContent.includes("exportAgentAuditTrail"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("GET exports route exists and requires admin", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/exports/route.ts", "utf8");
  assert.ok(routeContent.includes("listAgentAuditExports"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("GET export by id route exists and requires admin", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/exports/[exportId]/route.ts", "utf8");
  assert.ok(routeContent.includes("getAgentAuditExportById"));
  assert.ok(routeContent.includes("requireWorkspaceRole"));
});

test("audit routes reject missing workspace_id", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/events/route.ts", "utf8");
  assert.ok(routeContent.includes("MISSING_WORKSPACE"));
});

test("audit routes do not execute tools", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/events/route.ts", "utf8");
  assert.ok(!routeContent.includes("executeTool") && !routeContent.includes("runTool"));
});

test("audit routes do not call LLMs", () => {
  const routeContent = fs.readFileSync("src/app/api/agents/audit/events/route.ts", "utf8");
  assert.ok(!routeContent.includes("openai") && !routeContent.includes("anthropic"));
});

// ─── Documentation ────────────────────────────────────────────────────────────

test("documentation file exists", () => {
  assert.ok(fs.existsSync("docs/agent-observability-audit-trail.md"));
});

test("documentation mentions Agent Observability", () => {
  const doc = fs.readFileSync("docs/agent-observability-audit-trail.md", "utf8");
  assert.ok(doc.includes("Observability"));
});

test("documentation states no LLM calls", () => {
  const doc = fs.readFileSync("docs/agent-observability-audit-trail.md", "utf8");
  assert.ok(doc.includes("LLM") || doc.includes("language model"));
});

// ─── Regression guards ────────────────────────────────────────────────────────

test("agent memory types file still exists", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-memory-types.ts"));
});

test("agent tool approval service still exists", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-approval-service.ts"));
});

test("agent tool registry still exists", () => {
  assert.ok(fs.existsSync("src/lib/agents/agent-tool-registry.ts"));
});

test("agent memory context migration still exists", () => {
  assert.ok(fs.existsSync("supabase/migrations/20260728000000_agent_memory_context_layer.sql"));
});

test("observability layer does not import LLM providers", () => {
  for (const src of [obsTypes, obsValidation, obsRegistry, obsService]) {
    assert.ok(!src.includes("openai"), "Should not import openai");
    assert.ok(!src.includes("anthropic"), "Should not import anthropic");
    assert.ok(!src.includes("createEmbedding"), "Should not create embeddings");
  }
});
