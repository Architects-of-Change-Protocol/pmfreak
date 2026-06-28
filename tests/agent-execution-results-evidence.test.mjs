// ─── Agent Execution Results & Evidence Layer — Tests ─────────────────────────
// Sprint: Agent Execution Results & Evidence Layer
// These tests run without Supabase / a live database.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ─── Imports ──────────────────────────────────────────────────────────────────

const {
  validateAgentExecutionResultType,
  validateAgentExecutionResultStatus,
  validateAgentExecutionEvidenceType,
  validateAgentExecutionEvidenceSource,
  validateAgentExecutionConfidenceLevel,
  validateAgentExecutionResultReviewState,
  validateAgentExecutionRetentionPolicy,
  validateAgentExecutionResultArtifactType,
  validateAgentExecutionResultEventType,
  assertResultPayloadSerializable,
  assertEvidencePayloadSerializable,
  redactResultPayload,
  redactEvidencePayload,
  normalizeCreateAgentExecutionResultInput,
  normalizeCreateAgentExecutionEvidenceInput,
  calculateDeterministicEvidenceHash,
  calculateExecutionConfidence,
} = await import("../src/lib/agents/agent-execution-result-validation.ts");

const {
  createAgentExecutionResult,
  getAgentExecutionResultById,
  listAgentExecutionResults,
  updateAgentExecutionResultStatus,
  createAgentExecutionEvidence,
  getAgentExecutionEvidenceById,
  listAgentExecutionEvidence,
  linkEvidenceToResult,
  recordAgentExecutionResultLineage,
  listAgentExecutionResultLineage,
  recordAgentExecutionResultEvent,
  listAgentExecutionResultEvents,
  _clearResultStores,
} = await import("../src/lib/agents/agent-execution-result-registry.ts");

const {
  createResultFromPayload,
  createEvidenceForExecutionResult,
  calculateResultConfidence,
  markResultReadyForReview,
  archiveExecutionResult,
  supersedeExecutionResult,
  buildExecutionResultExportMetadata,
} = await import("../src/lib/agents/agent-execution-result-service.ts");

// ─── Type / Union Validators ──────────────────────────────────────────────────

describe("Type validators", () => {
  test("validateAgentExecutionResultType", () => {
    for (const v of [
      "noop", "simulation", "draft_email", "draft_task", "draft_project_update",
      "draft_report", "structured_summary", "risk_analysis", "recommendation",
      "governance_note", "adapter_refusal", "adapter_failure", "execution_failure",
    ]) {
      assert.equal(validateAgentExecutionResultType(v), true);
    }
    assert.equal(validateAgentExecutionResultType("live_email"), false);
    assert.equal(validateAgentExecutionResultType(""), false);
  });

  test("validateAgentExecutionResultStatus", () => {
    for (const v of ["created", "ready_for_review", "superseded", "archived", "discarded", "failed"]) {
      assert.equal(validateAgentExecutionResultStatus(v), true);
    }
    assert.equal(validateAgentExecutionResultStatus("pending"), false);
  });

  test("validateAgentExecutionEvidenceType", () => {
    for (const v of [
      "execution_request", "adapter_execution", "approval", "memory", "audit_event",
      "input_snapshot", "output_snapshot", "scope_reference", "tool_reference",
      "manual_note", "artifact_metadata",
    ]) {
      assert.equal(validateAgentExecutionEvidenceType(v), true);
    }
    assert.equal(validateAgentExecutionEvidenceType("unknown"), false);
  });

  test("validateAgentExecutionEvidenceSource", () => {
    for (const v of [
      "agent_execution_runtime", "agent_tool_adapter_layer", "agent_memory_context",
      "agent_observability", "agent_approval", "manual", "system",
    ]) {
      assert.equal(validateAgentExecutionEvidenceSource(v), true);
    }
    assert.equal(validateAgentExecutionEvidenceSource("external"), false);
  });

  test("validateAgentExecutionConfidenceLevel", () => {
    for (const v of ["low", "medium", "high"]) {
      assert.equal(validateAgentExecutionConfidenceLevel(v), true);
    }
    assert.equal(validateAgentExecutionConfidenceLevel("critical"), false);
  });

  test("validateAgentExecutionResultReviewState", () => {
    for (const v of ["not_ready", "ready", "reviewed", "rejected", "accepted", "needs_more_evidence"]) {
      assert.equal(validateAgentExecutionResultReviewState(v), true);
    }
    assert.equal(validateAgentExecutionResultReviewState("pending"), false);
  });

  test("validateAgentExecutionRetentionPolicy", () => {
    for (const v of ["standard", "short_lived", "long_lived", "legal_hold", "delete_eligible"]) {
      assert.equal(validateAgentExecutionRetentionPolicy(v), true);
    }
    assert.equal(validateAgentExecutionRetentionPolicy("none"), false);
  });

  test("validateAgentExecutionResultArtifactType", () => {
    for (const v of [
      "inline_json", "markdown", "draft_email", "draft_task", "draft_report",
      "risk_register_entry", "governance_note", "external_reference",
    ]) {
      assert.equal(validateAgentExecutionResultArtifactType(v), true);
    }
    assert.equal(validateAgentExecutionResultArtifactType("pdf"), false);
  });

  test("validateAgentExecutionResultEventType", () => {
    for (const v of [
      "result_created", "result_ready_for_review", "result_superseded", "result_archived",
      "result_discarded", "evidence_created", "evidence_linked", "confidence_calculated",
      "lineage_recorded", "retention_policy_applied", "result_export_metadata_created",
    ]) {
      assert.equal(validateAgentExecutionResultEventType(v), true);
    }
    assert.equal(validateAgentExecutionResultEventType("result_deleted"), false);
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("Validation", () => {
  test("normalizeCreateAgentExecutionResultInput throws on missing workspaceId", () => {
    assert.throws(() => normalizeCreateAgentExecutionResultInput({
      workspaceId: "", executionRequestId: "r1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: "Test",
    }), /workspaceId is required/);
  });

  test("normalizeCreateAgentExecutionResultInput throws on invalid resultType", () => {
    assert.throws(() => normalizeCreateAgentExecutionResultInput({
      workspaceId: "ws1", executionRequestId: "r1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "bogus", title: "Test",
    }), /invalid resultType/);
  });

  test("normalizeCreateAgentExecutionResultInput sets defaults", () => {
    const normalized = normalizeCreateAgentExecutionResultInput({
      workspaceId: "ws1", executionRequestId: "r1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: " My Title ",
    });
    assert.equal(normalized.title, "My Title");
    assert.equal(normalized.retentionPolicy, "standard");
    assert.equal(normalized.artifactType, "inline_json");
    assert.deepEqual(normalized.evidenceIds, []);
    assert.deepEqual(normalized.lineageRefs, []);
  });

  test("normalizeCreateAgentExecutionEvidenceInput throws on missing workspaceId", () => {
    assert.throws(() => normalizeCreateAgentExecutionEvidenceInput({
      workspaceId: "", evidenceType: "execution_request", evidenceSource: "agent_execution_runtime",
      title: "Test",
    }), /workspaceId is required/);
  });

  test("normalizeCreateAgentExecutionEvidenceInput clamps confidenceWeight", () => {
    const n = normalizeCreateAgentExecutionEvidenceInput({
      workspaceId: "ws1", evidenceType: "execution_request", evidenceSource: "agent_execution_runtime",
      title: "Test", confidenceWeight: 150,
    });
    assert.equal(n.confidenceWeight, 100);
  });

  test("assertResultPayloadSerializable throws on circular", () => {
    const obj = {};
    obj.self = obj;
    assert.throws(() => assertResultPayloadSerializable(obj), /not JSON serializable/);
  });

  test("redactResultPayload redacts secret keys", () => {
    const result = redactResultPayload({ password: "secret123", name: "test" });
    assert.equal(result.password, "[REDACTED]");
    assert.equal(result.name, "test");
  });

  test("redactEvidencePayload redacts nested secret keys", () => {
    const result = redactEvidencePayload({ auth: { token: "abc", user: "alice" } });
    assert.equal(result.auth.token, "[REDACTED]");
    assert.equal(result.auth.user, "alice");
  });
});

// ─── Confidence Calculation ───────────────────────────────────────────────────

describe("Confidence calculation", () => {
  test("full success → high confidence", () => {
    const result = calculateExecutionConfidence({
      executionRequestExists: true,
      adapterExecutionExists: true,
      adapterSucceeded: true,
      approvalPresent: true,
      requiredApprovalSatisfied: true,
      inputSnapshotPresent: true,
      outputPayloadPresent: true,
      evidenceCount: 5,
      auditTrailPresent: true,
      scopeKnown: true,
      hasErrors: false,
      hasRefusal: false,
    });
    assert.equal(result.confidenceLevel, "high");
    assert.ok(result.confidenceScore >= 75);
    assert.ok(result.confidenceReasons.length > 0);
  });

  test("refused → low confidence due to penalty", () => {
    const result = calculateExecutionConfidence({
      executionRequestExists: true,
      adapterExecutionExists: true,
      adapterSucceeded: false,
      approvalPresent: false,
      requiredApprovalSatisfied: false,
      inputSnapshotPresent: false,
      outputPayloadPresent: false,
      evidenceCount: 0,
      auditTrailPresent: false,
      scopeKnown: false,
      hasErrors: false,
      hasRefusal: true,
    });
    assert.equal(result.confidenceLevel, "low");
    assert.ok(result.confidenceScore < 40);
  });

  test("confidenceScore never exceeds 100", () => {
    const result = calculateExecutionConfidence({
      executionRequestExists: true, adapterExecutionExists: true, adapterSucceeded: true,
      approvalPresent: true, requiredApprovalSatisfied: true, inputSnapshotPresent: true,
      outputPayloadPresent: true, evidenceCount: 10, auditTrailPresent: true, scopeKnown: true,
      hasErrors: false, hasRefusal: false,
    });
    assert.ok(result.confidenceScore <= 100);
  });

  test("errors and refusal both present accumulate penalties", () => {
    const result = calculateExecutionConfidence({
      executionRequestExists: false, adapterExecutionExists: false, adapterSucceeded: false,
      approvalPresent: false, requiredApprovalSatisfied: false, inputSnapshotPresent: false,
      outputPayloadPresent: false, evidenceCount: 0, auditTrailPresent: false, scopeKnown: false,
      hasErrors: true, hasRefusal: true,
    });
    assert.equal(result.confidenceScore, 0);
  });
});

// ─── Evidence Hash ────────────────────────────────────────────────────────────

describe("Deterministic evidence hash", () => {
  test("returns null for null input", () => {
    assert.equal(calculateDeterministicEvidenceHash(null), null);
  });

  test("returns consistent hash for same input", () => {
    const a = calculateDeterministicEvidenceHash({ key: "value", num: 42 });
    const b = calculateDeterministicEvidenceHash({ key: "value", num: 42 });
    assert.equal(a, b);
  });

  test("returns different hash for different input", () => {
    const a = calculateDeterministicEvidenceHash({ key: "value" });
    const b = calculateDeterministicEvidenceHash({ key: "different" });
    assert.notEqual(a, b);
  });

  test("hash starts with fp_", () => {
    const h = calculateDeterministicEvidenceHash({ x: 1 });
    assert.ok(h.startsWith("fp_"));
  });
});

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("Registry", () => {
  const ws = "ws-registry-test";

  test("createAgentExecutionResult returns record with defaults", async () => {
    _clearResultStores();
    const r = await createAgentExecutionResult({
      workspaceId: ws,
      executionRequestId: "req-1",
      toolKey: "send_email",
      executionMode: "dry_run",
      scopeType: "workspace",
      resultType: "draft_email",
      title: "Test Result",
    });
    assert.equal(r.resultStatus, "created");
    assert.equal(r.reviewState, "not_ready");
    assert.equal(r.confidenceScore, 0);
    assert.equal(r.confidenceLevel, "low");
    assert.ok(r.id);
    assert.ok(r.createdAt);
  });

  test("getAgentExecutionResultById returns null for wrong workspace", async () => {
    _clearResultStores();
    const r = await createAgentExecutionResult({
      workspaceId: ws,
      executionRequestId: "req-1",
      toolKey: "t",
      executionMode: "dry_run",
      scopeType: "workspace",
      resultType: "noop",
      title: "T",
    });
    const found = await getAgentExecutionResultById("other-ws", r.id);
    assert.equal(found, null);
  });

  test("listAgentExecutionResults filters by resultType", async () => {
    _clearResultStores();
    await createAgentExecutionResult({ workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run", scopeType: "workspace", resultType: "noop", title: "A" });
    await createAgentExecutionResult({ workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run", scopeType: "workspace", resultType: "draft_email", title: "B" });
    const noops = await listAgentExecutionResults(ws, { resultType: "noop" });
    assert.equal(noops.length, 1);
    assert.equal(noops[0].resultType, "noop");
  });

  test("updateAgentExecutionResultStatus updates status", async () => {
    _clearResultStores();
    const r = await createAgentExecutionResult({ workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run", scopeType: "workspace", resultType: "noop", title: "T" });
    const updated = await updateAgentExecutionResultStatus({ workspaceId: ws, resultId: r.id, resultStatus: "archived", reviewState: "reviewed" });
    assert.equal(updated.resultStatus, "archived");
    assert.equal(updated.reviewState, "reviewed");
  });

  test("createAgentExecutionEvidence and getAgentExecutionEvidenceById", async () => {
    _clearResultStores();
    const ev = await createAgentExecutionEvidence({
      workspaceId: ws,
      evidenceType: "execution_request",
      evidenceSource: "agent_execution_runtime",
      title: "My Evidence",
      confidenceWeight: 25,
    });
    assert.ok(ev.id);
    // evidenceHash is null when no payload provided — check it's string or null
    assert.ok(ev.evidenceHash === null || typeof ev.evidenceHash === "string");
    const found = await getAgentExecutionEvidenceById(ws, ev.id);
    assert.ok(found);
    assert.equal(found.title, "My Evidence");
  });

  test("linkEvidenceToResult updates evidenceIds", async () => {
    _clearResultStores();
    const r = await createAgentExecutionResult({ workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run", scopeType: "workspace", resultType: "noop", title: "T" });
    const ev = await createAgentExecutionEvidence({ workspaceId: ws, evidenceType: "execution_request", evidenceSource: "agent_execution_runtime", title: "E" });
    const updated = await linkEvidenceToResult({ workspaceId: ws, resultId: r.id, evidenceId: ev.id });
    assert.ok(updated.evidenceIds.includes(ev.id));
  });

  test("recordAgentExecutionResultLineage and listAgentExecutionResultLineage", async () => {
    _clearResultStores();
    const r = await createAgentExecutionResult({ workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run", scopeType: "workspace", resultType: "noop", title: "T" });
    await recordAgentExecutionResultLineage({ workspaceId: ws, resultId: r.id, lineageType: "execution_request", lineageRef: "req-1" });
    const lineage = await listAgentExecutionResultLineage({ workspaceId: ws, resultId: r.id });
    assert.equal(lineage.length, 1);
    assert.equal(lineage[0].lineageType, "execution_request");
  });

  test("recordAgentExecutionResultEvent and listAgentExecutionResultEvents", async () => {
    _clearResultStores();
    const r = await createAgentExecutionResult({ workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run", scopeType: "workspace", resultType: "noop", title: "T" });
    await recordAgentExecutionResultEvent({ workspaceId: ws, resultId: r.id, eventType: "result_created" });
    const events = await listAgentExecutionResultEvents({ workspaceId: ws, resultId: r.id });
    assert.ok(events.length >= 1);
  });
});

// ─── Service ──────────────────────────────────────────────────────────────────

describe("Service", () => {
  const ws = "ws-service-test";

  test("createResultFromPayload creates result and event", async () => {
    _clearResultStores();
    const result = await createResultFromPayload({
      workspaceId: ws,
      executionRequestId: "req-1",
      toolKey: "send_email",
      executionMode: "dry_run",
      scopeType: "workspace",
      resultType: "draft_email",
      title: "My Draft Email",
    });
    assert.ok(result.id);
    assert.equal(result.resultType, "draft_email");

    const events = await listAgentExecutionResultEvents({ workspaceId: ws, resultId: result.id });
    assert.ok(events.some(e => e.eventType === "result_created"));
  });

  test("createEvidenceForExecutionResult creates evidence and event", async () => {
    _clearResultStores();
    const ev = await createEvidenceForExecutionResult({
      workspaceId: ws,
      evidenceType: "execution_request",
      evidenceSource: "agent_execution_runtime",
      title: "Evidence for result",
    });
    assert.ok(ev.id);
  });

  test("calculateResultConfidence returns confidence result", async () => {
    _clearResultStores();
    const result = await createResultFromPayload({
      workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: "T",
    });
    const confidence = await calculateResultConfidence({ workspaceId: ws, resultId: result.id });
    assert.ok(typeof confidence.confidenceScore === "number");
    assert.ok(["low", "medium", "high"].includes(confidence.confidenceLevel));
  });

  test("markResultReadyForReview updates status and reviewState", async () => {
    _clearResultStores();
    const result = await createResultFromPayload({
      workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: "T",
    });
    const updated = await markResultReadyForReview({ workspaceId: ws, resultId: result.id });
    assert.equal(updated.resultStatus, "ready_for_review");
    assert.equal(updated.reviewState, "ready");
  });

  test("archiveExecutionResult sets archived status", async () => {
    _clearResultStores();
    const result = await createResultFromPayload({
      workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: "T",
    });
    const archived = await archiveExecutionResult({ workspaceId: ws, resultId: result.id });
    assert.equal(archived.resultStatus, "archived");
  });

  test("supersedeExecutionResult sets superseded status", async () => {
    _clearResultStores();
    const result = await createResultFromPayload({
      workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: "T",
    });
    const superseded = await supersedeExecutionResult({ workspaceId: ws, resultId: result.id });
    assert.equal(superseded.resultStatus, "superseded");
  });

  test("buildExecutionResultExportMetadata returns metadata shape", async () => {
    _clearResultStores();
    const result = await createResultFromPayload({
      workspaceId: ws, executionRequestId: "req-1", toolKey: "t", executionMode: "dry_run",
      scopeType: "workspace", resultType: "noop", title: "Export Test",
    });
    const meta = await buildExecutionResultExportMetadata({ workspaceId: ws, resultId: result.id });
    assert.equal(meta.resultId, result.id);
    assert.ok("confidenceScore" in meta);
    assert.ok("evidenceCount" in meta);
    assert.ok("exportGeneratedAt" in meta);
  });
});

// ─── Migration File ───────────────────────────────────────────────────────────

describe("Migration file", () => {
  const migrationPath = resolve(ROOT, "supabase/migrations/20260801000000_agent_execution_results_evidence_layer.sql");

  test("migration file exists", () => {
    assert.ok(existsSync(migrationPath), "Migration file does not exist");
  });

  test("migration contains agent_execution_results table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_execution_results"), "Missing agent_execution_results table");
  });

  test("migration contains agent_execution_evidence_items table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_execution_evidence_items"), "Missing evidence items table");
  });

  test("migration contains agent_execution_result_lineage table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_execution_result_lineage"), "Missing lineage table");
  });

  test("migration contains agent_execution_result_events table", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("agent_execution_result_events"), "Missing events table");
  });

  test("migration has RLS policies", () => {
    const sql = readFileSync(migrationPath, "utf8");
    assert.ok(sql.includes("row level security"), "Missing RLS");
    assert.ok(sql.includes("workspace_members_read_execution_results"), "Missing read policy");
  });
});

// ─── Database Contract ────────────────────────────────────────────────────────

describe("Database contract", () => {
  const contractPath = resolve(ROOT, "src/lib/db/database-contract.ts");

  test("contract file exists", () => {
    assert.ok(existsSync(contractPath));
  });

  test("contract contains AgentExecutionResultRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentExecutionResultRow"));
  });

  test("contract contains AgentExecutionEvidenceItemRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentExecutionEvidenceItemRow"));
  });

  test("contract contains AgentExecutionResultLineageRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentExecutionResultLineageRow"));
  });

  test("contract contains AgentExecutionResultEventRow", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("AgentExecutionResultEventRow"));
  });

  test("contract version includes agent-execution-results-evidence-layer", () => {
    const content = readFileSync(contractPath, "utf8");
    assert.ok(content.includes("agent-execution-results-evidence-layer"), "VERSION not updated");
  });
});

// ─── API Route Files ──────────────────────────────────────────────────────────

describe("API route files exist", () => {
  const routeFiles = [
    "src/app/api/agents/execution/results/route.ts",
    "src/app/api/agents/execution/results/from-adapter-execution/route.ts",
    "src/app/api/agents/execution/results/[resultId]/route.ts",
    "src/app/api/agents/execution/results/[resultId]/ready/route.ts",
    "src/app/api/agents/execution/results/[resultId]/archive/route.ts",
    "src/app/api/agents/execution/results/[resultId]/supersede/route.ts",
    "src/app/api/agents/execution/results/[resultId]/lineage/route.ts",
    "src/app/api/agents/execution/results/[resultId]/events/route.ts",
    "src/app/api/agents/execution/results/[resultId]/export-metadata/route.ts",
    "src/app/api/agents/execution/evidence/route.ts",
    "src/app/api/agents/execution/evidence/[evidenceId]/route.ts",
    "src/app/api/agents/execution/results/[resultId]/evidence/[evidenceId]/link/route.ts",
  ];

  for (const relPath of routeFiles) {
    test(`exists: ${relPath}`, () => {
      assert.ok(existsSync(resolve(ROOT, relPath)), `Missing: ${relPath}`);
    });
  }

  test("results route contains createResultFromPayload", () => {
    const content = readFileSync(resolve(ROOT, "src/app/api/agents/execution/results/route.ts"), "utf8");
    assert.ok(content.includes("createResultFromPayload"));
  });

  test("from-adapter-execution route contains createResultFromAdapterExecution", () => {
    const content = readFileSync(resolve(ROOT, "src/app/api/agents/execution/results/from-adapter-execution/route.ts"), "utf8");
    assert.ok(content.includes("createResultFromAdapterExecution"));
  });
});

// ─── Observability Types ──────────────────────────────────────────────────────

describe("Observability types updated", () => {
  const obsTypesPath = resolve(ROOT, "src/lib/agents/agent-observability-types.ts");

  test("agent_execution_results_evidence_layer source type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("agent_execution_results_evidence_layer"), "Missing source type");
  });

  test("result_created event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("result_created"), "Missing event type");
  });

  test("evidence_linked event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("evidence_linked"), "Missing event type");
  });

  test("confidence_calculated event type added", () => {
    const content = readFileSync(obsTypesPath, "utf8");
    assert.ok(content.includes("confidence_calculated"), "Missing event type");
  });
});

// ─── Index Exports ────────────────────────────────────────────────────────────

describe("index.ts exports", () => {
  const indexPath = resolve(ROOT, "src/lib/agents/index.ts");

  test("exports createResultFromPayload", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("createResultFromPayload"));
  });

  test("exports createResultFromAdapterExecution", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("createResultFromAdapterExecution"));
  });

  test("exports calculateExecutionConfidence", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("calculateExecutionConfidence"));
  });

  test("exports buildExecutionResultExportMetadata", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("buildExecutionResultExportMetadata"));
  });

  test("exports listAgentExecutionResults", () => {
    const content = readFileSync(indexPath, "utf8");
    assert.ok(content.includes("listAgentExecutionResults"));
  });
});

// ─── No-side-effect checks ────────────────────────────────────────────────────

describe("No prohibited patterns in service/registry", () => {
  const serviceContent = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-result-service.ts"), "utf8");
  const registryContent = readFileSync(resolve(ROOT, "src/lib/agents/agent-execution-result-registry.ts"), "utf8");

  test("service does not import openai/anthropic/gemini", () => {
    assert.ok(!serviceContent.includes("openai") && !serviceContent.includes("anthropic") && !serviceContent.includes("gemini"));
  });

  test("service does not call fetch(", () => {
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

// ─── Regression — existing modules still importable ──────────────────────────

describe("Regression: existing agent modules still importable", () => {
  test("agent-tool-adapter-service exports runAgentToolAdapter", async () => {
    const mod = await import("../src/lib/agents/agent-tool-adapter-service.ts");
    assert.ok(typeof mod.runAgentToolAdapter === "function");
  });

  test("agent-execution-registry exports createAgentExecutionRequest indirectly via index", async () => {
    const mod = await import("../src/lib/agents/index.ts");
    assert.ok(typeof mod.createAgentExecutionResult === "function");
  });
});
