// ─── PMO Beta Onboarding / Demo Data / Tenant Readiness — Tests ──────────────
// Verifies all functions are safe, deterministic, and non-destructive.
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// Does NOT create production tenants or production customers.
// All demo data uses fictional names only.

import { describe, it, before, afterEach } from "node:test";
import assert from "node:assert/strict";

// ─── Dynamic imports ──────────────────────────────────────────────────────────

let createBetaReadinessPlanService;
let generateDemoDataBundle;
let runBetaOnboardingChecklist;
let recordBetaWorkspaceReadinessService;
let recordBetaAdminReadinessService;
let runTenantReadinessValidation;
let evaluateBetaReadinessGate;
let recordBetaReadinessBlockerService;
let recordBetaReadinessRemediationService;
let generateBetaReadinessExport;
let archiveBetaReadinessPlan;
let buildBetaReadinessSummary;
let getBetaReadinessPlanData;
let listBetaReadinessBlockers;
let listBetaReadinessEvents;
let _clearBetaReadinessStores;
let ALL_BETA_READINESS_SCOPES;
let ALL_BETA_BLOCKER_TYPES;
let ALL_DEMO_BUNDLE_TYPES;
let ALL_DEMO_PROJECT_SCENARIO_TYPES;
let ALL_DEMO_GOVERNANCE_SCENARIO_TYPES;
let ALL_DEMO_HANDOFF_SCENARIO_TYPES;
let ALL_CHECKLIST_ITEM_TYPES;
let BETA_EXPORT_BLOCKED_FIELD_PATTERNS;
let FORBIDDEN_SEMANTICS;
let validateBetaExportSafety;
let validateBetaReadinessPlanCreateInput;

before(async () => {
  const agents = await import("../src/lib/agents/index.js");
  createBetaReadinessPlanService = agents.createBetaReadinessPlanService;
  generateDemoDataBundle = agents.generateDemoDataBundle;
  runBetaOnboardingChecklist = agents.runBetaOnboardingChecklist;
  recordBetaWorkspaceReadinessService = agents.recordBetaWorkspaceReadinessService;
  recordBetaAdminReadinessService = agents.recordBetaAdminReadinessService;
  runTenantReadinessValidation = agents.runTenantReadinessValidation;
  evaluateBetaReadinessGate = agents.evaluateBetaReadinessGate;
  recordBetaReadinessBlockerService = agents.recordBetaReadinessBlockerService;
  recordBetaReadinessRemediationService = agents.recordBetaReadinessRemediationService;
  generateBetaReadinessExport = agents.generateBetaReadinessExport;
  archiveBetaReadinessPlan = agents.archiveBetaReadinessPlan;
  buildBetaReadinessSummary = agents.buildBetaReadinessSummary;
  getBetaReadinessPlanData = agents.getBetaReadinessPlanData;
  listBetaReadinessBlockers = agents.listBetaReadinessBlockers;
  listBetaReadinessEvents = agents.listBetaReadinessEvents;
  _clearBetaReadinessStores = agents._clearBetaReadinessStores;
  ALL_BETA_READINESS_SCOPES = agents.ALL_BETA_READINESS_SCOPES;
  ALL_BETA_BLOCKER_TYPES = agents.ALL_BETA_BLOCKER_TYPES;
  ALL_DEMO_BUNDLE_TYPES = agents.ALL_DEMO_BUNDLE_TYPES;
  ALL_DEMO_PROJECT_SCENARIO_TYPES = agents.ALL_DEMO_PROJECT_SCENARIO_TYPES;
  ALL_DEMO_GOVERNANCE_SCENARIO_TYPES = agents.ALL_DEMO_GOVERNANCE_SCENARIO_TYPES;
  ALL_DEMO_HANDOFF_SCENARIO_TYPES = agents.ALL_DEMO_HANDOFF_SCENARIO_TYPES;
  ALL_CHECKLIST_ITEM_TYPES = agents.ALL_CHECKLIST_ITEM_TYPES;
  BETA_EXPORT_BLOCKED_FIELD_PATTERNS = agents.BETA_EXPORT_BLOCKED_FIELD_PATTERNS;
  FORBIDDEN_SEMANTICS = agents.FORBIDDEN_SEMANTICS;
  validateBetaExportSafety = agents.validateBetaExportSafety;
  validateBetaReadinessPlanCreateInput = agents.validateBetaReadinessPlanCreateInput;
});

afterEach(() => {
  _clearBetaReadinessStores();
});

const WS = "ws-beta-readiness-test";

// ─── Scope and Type Coverage ──────────────────────────────────────────────────

describe("beta readiness scopes", () => {
  it("includes all 6 scopes", () => {
    assert.equal(ALL_BETA_READINESS_SCOPES.length, 6);
    assert.ok(ALL_BETA_READINESS_SCOPES.includes("full_beta_readiness"));
    assert.ok(ALL_BETA_READINESS_SCOPES.includes("controlled_beta"));
    assert.ok(ALL_BETA_READINESS_SCOPES.includes("internal_demo"));
  });

  it("includes pmo_demo and sales_demo", () => {
    assert.ok(ALL_BETA_READINESS_SCOPES.includes("pmo_demo"));
    assert.ok(ALL_BETA_READINESS_SCOPES.includes("sales_demo"));
  });
});

describe("demo bundle types", () => {
  it("includes all 6 bundle types", () => {
    assert.equal(ALL_DEMO_BUNDLE_TYPES.length, 6);
    assert.ok(ALL_DEMO_BUNDLE_TYPES.includes("full_beta_demo"));
    assert.ok(ALL_DEMO_BUNDLE_TYPES.includes("governance_demo"));
  });
});

describe("checklist item types", () => {
  it("includes 13 item types", () => {
    assert.equal(ALL_CHECKLIST_ITEM_TYPES.length, 13);
    assert.ok(ALL_CHECKLIST_ITEM_TYPES.includes("demo_data_loaded"));
    assert.ok(ALL_CHECKLIST_ITEM_TYPES.includes("safety_checks_passed"));
    assert.ok(ALL_CHECKLIST_ITEM_TYPES.includes("known_limitations_reviewed"));
  });
});

describe("blocker types", () => {
  it("includes production_data_detected", () => {
    assert.ok(ALL_BETA_BLOCKER_TYPES.includes("production_data_detected"));
  });

  it("includes all key risk types", () => {
    assert.ok(ALL_BETA_BLOCKER_TYPES.includes("external_api_risk"));
    assert.ok(ALL_BETA_BLOCKER_TYPES.includes("adapter_execution_risk"));
    assert.ok(ALL_BETA_BLOCKER_TYPES.includes("policy_activation_risk"));
    assert.ok(ALL_BETA_BLOCKER_TYPES.includes("handoff_mutation_risk"));
  });
});

// ─── Beta Readiness Plan ──────────────────────────────────────────────────────

describe("createBetaReadinessPlanService", () => {
  it("creates a plan without calling external systems", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    assert.equal(plan.workspaceId, WS);
    assert.equal(plan.scope, "full_beta_readiness");
    assert.equal(plan.status, "created");
    assert.ok(plan.id);
  });

  it("requires workspaceId", async () => {
    await assert.rejects(() => createBetaReadinessPlanService({ scope: "internal_demo" }));
  });

  it("requires valid scope", async () => {
    await assert.rejects(() => createBetaReadinessPlanService({ workspaceId: WS, scope: "invalid_scope" }));
  });

  it("does not call AI", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    assert.ok(!plan.safePayloadJson.aiCalled);
  });

  it("emits beta_readiness_plan_created event", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "pmo_demo" });
    const events = await listBetaReadinessEvents(WS, plan.id);
    assert.ok(events.some((e) => e.eventType === "beta_readiness_plan_created"));
  });
});

// ─── Demo Data Bundle ─────────────────────────────────────────────────────────

describe("generateDemoDataBundle", () => {
  it("generates bundle with fictional names only", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const result = await generateDemoDataBundle(WS, plan.id, "full_beta_demo");
    assert.ok(result.bundle);
    assert.ok(result.projectScenarios.length > 0);
    assert.ok(result.governanceScenarios.length > 0);
    assert.ok(result.handoffScenarios.length > 0);
  });

  it("project scenarios have fictional names", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const result = await generateDemoDataBundle(WS, plan.id, "governance_demo");
    for (const scenario of result.projectScenarios) {
      assert.ok(scenario.fictionalProjectName, "should have fictional project name");
      assert.ok(scenario.fictionalPmName, "should have fictional pm name");
      assert.ok(scenario.fictionalClientName, "should have fictional client name");
    }
  });

  it("governance scenarios have fictional names", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const result = await generateDemoDataBundle(WS, plan.id, "governance_demo");
    for (const scenario of result.governanceScenarios) {
      assert.ok(scenario.fictionalPolicyTitle, "should have fictional policy title");
    }
  });

  it("bundle does not include real data flag", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const result = await generateDemoDataBundle(WS, plan.id, "project_handoff_demo");
    assert.ok(!result.bundle.safePayloadJson.realDataIncluded);
  });

  it("emits bundle created and validated events", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    await generateDemoDataBundle(WS, plan.id, "activation_demo");
    const events = await listBetaReadinessEvents(WS, plan.id);
    assert.ok(events.some((e) => e.eventType === "demo_data_bundle_created"));
    assert.ok(events.some((e) => e.eventType === "demo_data_bundle_validated"));
  });
});

// ─── Beta Onboarding Checklist ────────────────────────────────────────────────

describe("runBetaOnboardingChecklist", () => {
  it("runs all 13 checklist items", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const checklist = await runBetaOnboardingChecklist(WS, plan.id);
    assert.equal(checklist.totalItems, 13);
    assert.ok(checklist.passedItems > 0);
    assert.ok(["completed", "completed_with_warnings"].includes(checklist.status));
  });

  it("does not call external systems", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "internal_demo" });
    const checklist = await runBetaOnboardingChecklist(WS, plan.id);
    assert.ok(!checklist.safePayloadJson.aiCalled);
  });

  it("emits checklist created event", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "internal_demo" });
    await runBetaOnboardingChecklist(WS, plan.id);
    const events = await listBetaReadinessEvents(WS, plan.id);
    assert.ok(events.some((e) => e.eventType === "beta_onboarding_checklist_created"));
  });
});

// ─── Tenant Readiness Validation ──────────────────────────────────────────────

describe("runTenantReadinessValidation", () => {
  it("runs workspace isolation and RLS checks", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    const validations = await runTenantReadinessValidation(WS, plan.id);
    assert.ok(validations.length > 0);
    const isolationCheck = validations.find((v) => v.checkName === "workspace_isolation");
    assert.ok(isolationCheck, "workspace_isolation check should exist");
    assert.ok(isolationCheck.passed);
  });

  it("checks for no production data and no external calls", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    const validations = await runTenantReadinessValidation(WS, plan.id);
    const prodDataCheck = validations.find((v) => v.checkName === "no_production_data");
    assert.ok(prodDataCheck, "no_production_data check should exist");
    assert.ok(prodDataCheck.passed);
    const noApiCheck = validations.find((v) => v.checkName === "no_external_api_calls");
    assert.ok(noApiCheck?.passed);
  });
});

// ─── Beta Readiness Gate ──────────────────────────────────────────────────────

describe("evaluateBetaReadinessGate", () => {
  it("approves for controlled beta when no blockers", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    const result = await evaluateBetaReadinessGate(WS, plan.id);
    assert.equal(result.decision.decisionType, "approve_for_controlled_beta");
    assert.equal(result.gate.status, "passed");
  });

  it("rejects when critical blockers exist", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    await recordBetaReadinessBlockerService({
      workspaceId: WS,
      planId: plan.id,
      blockerType: "production_data_detected",
      severity: "critical",
      title: "Production data detected in demo bundle",
      description: "Real customer email addresses found in demo dataset",
    });
    const result = await evaluateBetaReadinessGate(WS, plan.id);
    assert.equal(result.decision.decisionType, "reject");
    assert.equal(result.gate.status, "failed");
  });

  it("approves with warnings for non-critical blockers", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    await recordBetaReadinessBlockerService({
      workspaceId: WS,
      planId: plan.id,
      blockerType: "missing_docs",
      severity: "low",
      title: "Support docs incomplete",
      description: "Support path documentation missing",
    });
    const result = await evaluateBetaReadinessGate(WS, plan.id);
    assert.equal(result.decision.decisionType, "approve_with_warnings");
    assert.equal(result.gate.status, "passed_with_warnings");
  });

  it("emits gate created and decision events", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    await evaluateBetaReadinessGate(WS, plan.id);
    const events = await listBetaReadinessEvents(WS, plan.id);
    assert.ok(events.some((e) => e.eventType === "beta_readiness_gate_created"));
    assert.ok(events.some((e) => e.eventType === "beta_readiness_decision_recorded"));
  });
});

// ─── Blocker Recording ────────────────────────────────────────────────────────

describe("recordBetaReadinessBlockerService", () => {
  it("records a blocker with open status", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const blocker = await recordBetaReadinessBlockerService({
      workspaceId: WS,
      planId: plan.id,
      blockerType: "rls_gap",
      severity: "high",
      title: "RLS gap in demo table",
      description: "agent_demo_data table missing workspace-scoped RLS policy",
    });
    assert.equal(blocker.status, "open");
    assert.equal(blocker.severity, "high");
    assert.equal(blocker.blockerType, "rls_gap");
  });

  it("requires title and description", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    await assert.rejects(() =>
      recordBetaReadinessBlockerService({
        workspaceId: WS,
        planId: plan.id,
        blockerType: "unknown",
        severity: "low",
      }),
    );
  });
});

// ─── Export Safety ────────────────────────────────────────────────────────────

describe("validateBetaExportSafety", () => {
  it("detects blocked field patterns", () => {
    const result = validateBetaExportSafety("Here is a password: secret123");
    assert.ok(!result.safe);
    assert.ok(result.violations.length > 0);
  });

  it("passes clean content", () => {
    const result = validateBetaExportSafety("Beta Readiness Plan — controlled_beta — Status: ready");
    assert.ok(result.safe);
    assert.equal(result.violations.length, 0);
  });

  it("detects real_email pattern", () => {
    const result = validateBetaExportSafety("Contact: real_email@company.com");
    assert.ok(!result.safe);
  });

  it("detects stack_trace pattern", () => {
    const result = validateBetaExportSafety("Error stack_trace: at line 42");
    assert.ok(!result.safe);
  });
});

describe("generateBetaReadinessExport", () => {
  it("generates markdown export without blocked content", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    const exp = await generateBetaReadinessExport(WS, plan.id, "markdown");
    assert.equal(exp.exportFormat, "markdown");
    assert.equal(exp.exportStatus, "ready");
    assert.ok(exp.safetyValidationPassed);
    assert.ok(exp.safeExportContent.includes("Beta Readiness Plan"));
  });

  it("generates json export", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "internal_demo" });
    const exp = await generateBetaReadinessExport(WS, plan.id, "json");
    assert.equal(exp.exportFormat, "json");
    assert.doesNotThrow(() => JSON.parse(exp.safeExportContent));
  });

  it("generates csv export", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "sales_demo" });
    const exp = await generateBetaReadinessExport(WS, plan.id, "csv");
    assert.equal(exp.exportFormat, "csv");
    assert.ok(exp.safeExportContent.includes("planId"));
  });

  it("emits export created event", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    await generateBetaReadinessExport(WS, plan.id, "markdown");
    const events = await listBetaReadinessEvents(WS, plan.id);
    assert.ok(events.some((e) => e.eventType === "beta_readiness_export_created"));
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────

describe("buildBetaReadinessSummary", () => {
  it("builds summary with correct fields", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    const summary = await buildBetaReadinessSummary(WS, plan.id);
    assert.equal(summary.planId, plan.id);
    assert.equal(summary.workspaceId, WS);
    assert.equal(summary.scope, "full_beta_readiness");
    assert.ok(Array.isArray(summary.nonGoals));
    assert.ok(summary.nonGoals.length > 0);
  });

  it("includes gate status when gate evaluated", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "controlled_beta" });
    await evaluateBetaReadinessGate(WS, plan.id);
    const summary = await buildBetaReadinessSummary(WS, plan.id);
    assert.ok(summary.gateStatus !== null);
  });
});

// ─── Archive ──────────────────────────────────────────────────────────────────

describe("archiveBetaReadinessPlan", () => {
  it("archives a plan and emits event", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "internal_demo" });
    const archived = await archiveBetaReadinessPlan(WS, plan.id);
    assert.equal(archived.status, "archived");
    const events = await listBetaReadinessEvents(WS, plan.id);
    assert.ok(events.some((e) => e.eventType === "beta_readiness_plan_archived"));
  });
});

// ─── Forbidden Semantics Presence Check ───────────────────────────────────────

describe("FORBIDDEN_SEMANTICS", () => {
  it("includes sendEmail and sendBetaInvite", () => {
    assert.ok(FORBIDDEN_SEMANTICS.includes("sendEmail"));
    assert.ok(FORBIDDEN_SEMANTICS.includes("sendBetaInvite"));
  });

  it("includes createProductionTenant and createProductionCustomer", () => {
    assert.ok(FORBIDDEN_SEMANTICS.includes("createProductionTenant"));
    assert.ok(FORBIDDEN_SEMANTICS.includes("createProductionCustomer"));
  });

  it("includes callOpenAI and callAnthropic", () => {
    assert.ok(FORBIDDEN_SEMANTICS.includes("callOpenAI"));
    assert.ok(FORBIDDEN_SEMANTICS.includes("callAnthropic"));
  });
});

// ─── Full Plan Data ───────────────────────────────────────────────────────────

describe("getBetaReadinessPlanData", () => {
  it("returns all plan data sections", async () => {
    const plan = await createBetaReadinessPlanService({ workspaceId: WS, scope: "full_beta_readiness" });
    await generateDemoDataBundle(WS, plan.id, "governance_demo");
    await runBetaOnboardingChecklist(WS, plan.id);
    const data = await getBetaReadinessPlanData(WS, plan.id);
    assert.ok(data.plan);
    assert.ok(Array.isArray(data.bundles));
    assert.ok(Array.isArray(data.checklists));
    assert.ok(Array.isArray(data.events));
    assert.ok(data.bundles.length > 0);
  });
});

// ─── Workspace Isolation ──────────────────────────────────────────────────────

describe("workspace isolation", () => {
  it("does not leak records across workspaces", async () => {
    const plan1 = await createBetaReadinessPlanService({ workspaceId: "ws-alpha", scope: "internal_demo" });
    const plan2 = await createBetaReadinessPlanService({ workspaceId: "ws-beta", scope: "controlled_beta" });
    const { listBetaReadinessPlans } = await import("../src/lib/agents/index.js");
    const alphaPlans = await listBetaReadinessPlans("ws-alpha");
    const betaPlans = await listBetaReadinessPlans("ws-beta");
    assert.ok(alphaPlans.every((p) => p.workspaceId === "ws-alpha"));
    assert.ok(betaPlans.every((p) => p.workspaceId === "ws-beta"));
    assert.equal(alphaPlans.length, 1);
    assert.equal(betaPlans.length, 1);
  });
});
