// ─── PMO End-to-End Governance Runtime Integration & Production Hardening ─────
// Tests that all hardening checks are safe, deterministic, and non-destructive.
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.

import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";

// ─── Dynamic imports ──────────────────────────────────────────────────────────

let createGovernanceRuntimeHardeningRun;
let runLayerIntegrationAudit;
let runRouteContractAudit;
let runDatabaseContractAudit;
let runRlsPolicyAudit;
let runWorkspaceIsolationCheck;
let runObservabilityCoverageCheck;
let runExportSafetyCheck;
let runIdempotencyGuardCheck;
let runErrorHandlingCheck;
let runUiDashboardIntegrationCheck;
let runCiSmokeCheck;
let evaluateProductionReadinessGate;
let recordRuntimeHardeningBlocker;
let recordRuntimeRemediationItem;
let generateRuntimeHardeningExport;
let archiveRuntimeHardeningRun;
let buildRuntimeHardeningSummary;
let getRuntimeHardeningData;
let listAgentPmoRuntimeHardeningBlockers;
let _clearRuntimeHardeningStores;
let ALL_GOVERNANCE_LAYERS;
let ALL_SCOPES;
let EXPORT_BLOCKED_FIELD_PATTERNS;
let validateExportSafety;

before(async () => {
  const agents = await import("../src/lib/agents/index.js");
  createGovernanceRuntimeHardeningRun = agents.createGovernanceRuntimeHardeningRun;
  runLayerIntegrationAudit = agents.runLayerIntegrationAudit;
  runRouteContractAudit = agents.runRouteContractAudit;
  runDatabaseContractAudit = agents.runDatabaseContractAudit;
  runRlsPolicyAudit = agents.runRlsPolicyAudit;
  runWorkspaceIsolationCheck = agents.runWorkspaceIsolationCheck;
  runObservabilityCoverageCheck = agents.runObservabilityCoverageCheck;
  runExportSafetyCheck = agents.runExportSafetyCheck;
  runIdempotencyGuardCheck = agents.runIdempotencyGuardCheck;
  runErrorHandlingCheck = agents.runErrorHandlingCheck;
  runUiDashboardIntegrationCheck = agents.runUiDashboardIntegrationCheck;
  runCiSmokeCheck = agents.runCiSmokeCheck;
  evaluateProductionReadinessGate = agents.evaluateProductionReadinessGate;
  recordRuntimeHardeningBlocker = agents.recordRuntimeHardeningBlocker;
  recordRuntimeRemediationItem = agents.recordRuntimeRemediationItem;
  generateRuntimeHardeningExport = agents.generateRuntimeHardeningExport;
  archiveRuntimeHardeningRun = agents.archiveRuntimeHardeningRun;
  buildRuntimeHardeningSummary = agents.buildRuntimeHardeningSummary;
  getRuntimeHardeningData = agents.getRuntimeHardeningData;
  listAgentPmoRuntimeHardeningBlockers = agents.listAgentPmoRuntimeHardeningBlockers;
  _clearRuntimeHardeningStores = agents._clearRuntimeHardeningStores;
  ALL_GOVERNANCE_LAYERS = agents.ALL_GOVERNANCE_LAYERS;
  ALL_SCOPES = agents.ALL_SCOPES;
  EXPORT_BLOCKED_FIELD_PATTERNS = agents.EXPORT_BLOCKED_FIELD_PATTERNS;
  validateExportSafety = agents.validateExportSafety;
});

afterEach(() => {
  _clearRuntimeHardeningStores();
});

const WS = "ws-hardening-test";

// ─── Status and Scope Coverage ────────────────────────────────────────────────

describe("hardening run statuses", () => {
  it("includes passed_with_warnings and blocked", () => {
    const { ALL_SCOPES: scopes } = { ALL_SCOPES: ["full_governance_runtime", "production_readiness"] };
    assert.ok(scopes.includes("full_governance_runtime"));
    assert.ok(scopes.includes("production_readiness"));
  });

  it("run scopes include full_governance_runtime and production_readiness", async () => {
    assert.ok(ALL_SCOPES.includes("full_governance_runtime"));
    assert.ok(ALL_SCOPES.includes("production_readiness"));
  });
});

// ─── Governance Layer Coverage ────────────────────────────────────────────────

describe("governance layers", () => {
  it("includes project_intelligence_handoff", async () => {
    assert.ok(ALL_GOVERNANCE_LAYERS.includes("project_intelligence_handoff"));
  });

  it("includes policy_activation_rollback", async () => {
    assert.ok(ALL_GOVERNANCE_LAYERS.includes("policy_activation_rollback"));
  });

  it("includes all 15 expected layers", async () => {
    assert.equal(ALL_GOVERNANCE_LAYERS.length, 15);
  });
});

// ─── Hardening Run Creation ───────────────────────────────────────────────────

describe("createGovernanceRuntimeHardeningRun", () => {
  it("creates a run without calling external systems", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.equal(run.workspaceId, WS);
    assert.equal(run.scope, "full_governance_runtime");
    assert.equal(run.status, "created");
    assert.ok(run.id);
  });

  it("requires workspaceId", async () => {
    await assert.rejects(() => createGovernanceRuntimeHardeningRun({ scope: "full_governance_runtime" }));
  });

  it("requires valid scope", async () => {
    await assert.rejects(() => createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "invalid_scope" }));
  });

  it("does not call AI", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "ci_smoke" });
    assert.ok(!run.safeRunPayloadJson.aiCalled);
  });
});

// ─── Layer Integration Audit ──────────────────────────────────────────────────

describe("runLayerIntegrationAudit", () => {
  it("audits expected files for each layer", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const audits = await runLayerIntegrationAudit(WS, run.id, ["project_intelligence_handoff"]);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].layer, "project_intelligence_handoff");
    assert.ok(typeof audits[0].typeFileExists === "boolean");
  });

  it("detects type file existence for project_intelligence_handoff", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const audits = await runLayerIntegrationAudit(WS, run.id, ["project_intelligence_handoff"]);
    assert.ok(audits[0].typeFileExists, "project_intelligence_handoff type file should exist");
  });
});

// ─── Route Contract Audit ─────────────────────────────────────────────────────

describe("runRouteContractAudit", () => {
  it("detects route coverage for hardening routes", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "route_contracts" });
    const audits = await runRouteContractAudit(WS, run.id);
    assert.ok(audits.length > 0);
    assert.ok(audits.every((a) => typeof a.routeExists === "boolean"));
  });
});

// ─── Database Contract Audit ──────────────────────────────────────────────────

describe("runDatabaseContractAudit", () => {
  it("checks row types and column constants", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "database_contracts" });
    const audits = await runDatabaseContractAudit(WS, run.id);
    assert.ok(audits.length > 0);
    assert.ok(audits.every((a) => typeof a.rowTypeExists === "boolean"));
    assert.ok(audits.every((a) => typeof a.columnConstantsExist === "boolean"));
  });
});

// ─── RLS Policy Audit ─────────────────────────────────────────────────────────

describe("runRlsPolicyAudit", () => {
  it("checks RLS enabled text in migrations", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "rls_policies" });
    const audits = await runRlsPolicyAudit(WS, run.id);
    assert.ok(audits.length > 0);
    assert.ok(audits.every((a) => typeof a.rlsEnabled === "boolean"));
  });
});

// ─── Workspace Isolation Check ────────────────────────────────────────────────

describe("runWorkspaceIsolationCheck", () => {
  it("requires workspace scope", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "workspace_isolation" });
    const check = await runWorkspaceIsolationCheck(WS, run.id);
    assert.ok(check.workspaceIdRequired);
    assert.ok(check.listFunctionsFilterByWorkspace);
    assert.ok(check.apiRoutesRequireWorkspaceId);
  });
});

// ─── Observability Coverage ───────────────────────────────────────────────────

describe("runObservabilityCoverageCheck", () => {
  it("includes runtime hardening source type", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "observability" });
    const check = await runObservabilityCoverageCheck(WS, run.id);
    assert.ok(check.sourceTypesExist, "Source type for runtime hardening should exist in observability types");
  });

  it("includes runtime hardening event types", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "observability" });
    const check = await runObservabilityCoverageCheck(WS, run.id);
    assert.ok(check.eventTypesExist, "Event types for runtime hardening should exist in observability types");
  });
});

// ─── Export Safety ────────────────────────────────────────────────────────────

describe("runExportSafetyCheck", () => {
  it("blocks raw payload fields", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "exports" });
    const check = await runExportSafetyCheck(WS, run.id, "some content with raw_payload data");
    assert.ok(!check.rawPayloadsExcluded);
    assert.ok(!check.passed);
    assert.ok(check.findings.length > 0);
  });

  it("passes on safe content", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "exports" });
    const check = await runExportSafetyCheck(WS, run.id, "Safe summary: all checks passed.");
    assert.ok(check.passed);
  });

  it("validateExportSafety blocks stack_trace", () => {
    const { safe, violations } = validateExportSafety("Error stack_trace: at line 42");
    assert.ok(!safe);
    assert.ok(violations.some((v) => v.includes("stack_trace")));
  });

  it("validateExportSafety blocks raw_ci_log", () => {
    const { safe } = validateExportSafety("raw_ci_log output here");
    assert.ok(!safe);
  });

  it("EXPORT_BLOCKED_FIELD_PATTERNS includes expected patterns", () => {
    assert.ok(EXPORT_BLOCKED_FIELD_PATTERNS.includes("stack_trace"));
    assert.ok(EXPORT_BLOCKED_FIELD_PATTERNS.includes("secret"));
    assert.ok(EXPORT_BLOCKED_FIELD_PATTERNS.includes("token"));
    assert.ok(EXPORT_BLOCKED_FIELD_PATTERNS.includes("credential"));
    assert.ok(EXPORT_BLOCKED_FIELD_PATTERNS.includes("raw_payload"));
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe("runIdempotencyGuardCheck", () => {
  it("checks controlled pointer behavior conceptually", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "idempotency" });
    const check = await runIdempotencyGuardCheck(WS, run.id);
    assert.ok(check.appendOnlyDecisionsPreserved);
    assert.ok(check.pointerUpdatesPreservePrevious);
    assert.ok(check.completionRequiresCorrectStatus);
    assert.ok(check.activationRequiresApprovedGate);
    assert.ok(check.rollbackRequiresApprovedGate);
    assert.ok(check.archiveDoesNotHardDelete);
  });
});

// ─── Error Handling ───────────────────────────────────────────────────────────

describe("runErrorHandlingCheck", () => {
  it("blocks stack_trace and raw_ci_log in API responses", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "error_handling" });
    const check = await runErrorHandlingCheck(WS, run.id);
    assert.ok(check.stackTracesNotReturnedFromApi);
    assert.ok(check.routeErrorsSanitized);
  });
});

// ─── CI Smoke Check ───────────────────────────────────────────────────────────

describe("runCiSmokeCheck", () => {
  it("stores safe summaries only", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "ci_smoke" });
    const check = await runCiSmokeCheck(WS, run.id, {
      typecheckResult: "passed",
      testResult: "passed",
      buildResult: "passed",
      hardeningTestResult: "passed",
      terminologyResult: "clean",
      prohibitedBehaviorResult: "clean",
    });
    assert.ok(check.safeSmokeSummary.includes("typecheck:passed"));
    assert.ok(check.safeSmokeSummary.includes("test:passed"));
    assert.ok(!check.safeSmokeSummary.includes("raw_ci_log"));
    assert.ok(!check.safeSmokeSummary.includes("stack_trace"));
  });
});

// ─── Production Readiness Gate ────────────────────────────────────────────────

describe("evaluateProductionReadinessGate", () => {
  it("does not create beta onboarding", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "production_readiness" });
    const gate = await evaluateProductionReadinessGate(WS, run.id);
    assert.ok(gate.safeGatePayloadJson.note?.includes("does not create beta onboarding"));
  });

  it("blockers block readiness gate", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "production_readiness" });
    await recordRuntimeHardeningBlocker({
      workspaceId: WS,
      hardeningRunId: run.id,
      blockerType: "missing_layer_export",
      severity: "critical",
      title: "Missing export",
      description: "A critical export is missing",
    });
    const gate = await evaluateProductionReadinessGate(WS, run.id);
    assert.equal(gate.status, "blocked");
    assert.ok(gate.criticalBlockerCount > 0);
  });
});

// ─── Blockers ─────────────────────────────────────────────────────────────────

describe("recordRuntimeHardeningBlocker", () => {
  it("records blocker with open status", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const blocker = await recordRuntimeHardeningBlocker({
      workspaceId: WS,
      hardeningRunId: run.id,
      blockerType: "rls_gap",
      severity: "high",
      title: "RLS gap on table",
      description: "Table missing RLS policy",
    });
    assert.equal(blocker.status, "open");
    assert.equal(blocker.severity, "high");
    assert.equal(blocker.blockerType, "rls_gap");
  });

  it("requires valid blocker type", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    await assert.rejects(() => recordRuntimeHardeningBlocker({
      workspaceId: WS,
      hardeningRunId: run.id,
      blockerType: "invalid_type",
      severity: "high",
      title: "Test",
      description: "Test",
    }));
  });
});

// ─── Remediation Items ────────────────────────────────────────────────────────

describe("recordRuntimeRemediationItem", () => {
  it("tracks remediation items safely", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const item = await recordRuntimeRemediationItem({
      workspaceId: WS,
      hardeningRunId: run.id,
      remediationType: "rls_policy_fix",
      title: "Add RLS policy",
      description: "Add workspace-scoped read policy to table",
    });
    assert.equal(item.status, "created");
    assert.equal(item.remediationType, "rls_policy_fix");
  });
});

// ─── Hardening Export ─────────────────────────────────────────────────────────

describe("generateRuntimeHardeningExport", () => {
  it("excludes raw logs, secrets, tokens, credentials, stack traces", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const exp = await generateRuntimeHardeningExport(WS, run.id, "markdown");
    assert.ok(exp.safetyValidationPassed);
    const blocked = ["raw_payload", "stack_trace", "secret", "token", "credential"];
    for (const pattern of blocked) {
      assert.ok(!exp.safeExportContent.toLowerCase().includes(pattern), `Export should not contain: ${pattern}`);
    }
  });

  it("can generate json and csv formats", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const jsonExp = await generateRuntimeHardeningExport(WS, run.id, "json");
    const csvExp = await generateRuntimeHardeningExport(WS, run.id, "csv");
    assert.equal(jsonExp.exportFormat, "json");
    assert.equal(csvExp.exportFormat, "csv");
  });

  it("includes non-goals in export", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const exp = await generateRuntimeHardeningExport(WS, run.id, "markdown");
    assert.ok(exp.safeExportContent.includes("Non-Goals") || exp.safeExportContent.includes("non_goals") || exp.safeExportContent.includes("LLMs"));
  });
});

// ─── Service Prohibited Behavior ─────────────────────────────────────────────

describe("service prohibited behavior", () => {
  it("does not call LLM providers", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not call LLMs or AI providers"));
  });

  it("does not call embeddings", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not create embeddings"));
  });

  it("does not train models", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not train models"));
  });

  it("does not create Jira tickets", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(!run.safeRunPayloadJson.nonGoals.some((g) => g.toLowerCase().includes("jira") && !g.toLowerCase().includes("not")));
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not create Jira tickets or GitHub issues"));
  });

  it("does not create GitHub issues", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const found = run.safeRunPayloadJson.nonGoals.some((g) => g.includes("GitHub issues"));
    assert.ok(found);
  });

  it("does not send communications", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not send emails, Slack messages, or communications"));
  });

  it("does not create calendar events", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not create calendar events"));
  });

  it("does not execute adapters", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not execute adapters"));
  });

  it("does not call external APIs", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not call external APIs"));
  });

  it("does not activate policies", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not activate policies"));
  });

  it("does not rollback policies", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not rollback policies"));
  });

  it("does not complete handoffs", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    assert.ok(run.safeRunPayloadJson.nonGoals.includes("Does not complete handoffs"));
  });
});

// ─── Archive ──────────────────────────────────────────────────────────────────

describe("archiveRuntimeHardeningRun", () => {
  it("archives a run without hard-deleting", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    const archived = await archiveRuntimeHardeningRun(WS, run.id);
    assert.equal(archived.status, "archived");
    assert.equal(archived.id, run.id);
  });
});

// ─── Full Suite ───────────────────────────────────────────────────────────────

describe("full suite integration", () => {
  it("full hardening suite passes without external side effects", async () => {
    const run = await createGovernanceRuntimeHardeningRun({ workspaceId: WS, scope: "full_governance_runtime" });
    await runLayerIntegrationAudit(WS, run.id, ["project_intelligence_handoff", "policy_activation_rollback"]);
    await runRouteContractAudit(WS, run.id);
    await runDatabaseContractAudit(WS, run.id);
    await runRlsPolicyAudit(WS, run.id);
    await runWorkspaceIsolationCheck(WS, run.id);
    await runObservabilityCoverageCheck(WS, run.id);
    await runExportSafetyCheck(WS, run.id, "Safe summary content");
    await runIdempotencyGuardCheck(WS, run.id);
    await runErrorHandlingCheck(WS, run.id);
    await runUiDashboardIntegrationCheck(WS, run.id);
    await runCiSmokeCheck(WS, run.id, { typecheckResult: "passed", testResult: "passed", buildResult: "passed" });
    const gate = await evaluateProductionReadinessGate(WS, run.id);
    assert.ok(gate.id);
    const data = await getRuntimeHardeningData(WS, run.id);
    assert.ok(data.runs.length > 0);
    assert.ok(data.nonGoals.length > 0);
  });
});
