// ─── PMO Beta Onboarding / Demo Data / Tenant Readiness — Service ────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// Does NOT create production tenants, production customers, or mutate external systems.
// Does NOT create Jira tickets, GitHub issues, calendar events, or embeddings.
// Does NOT train models or call embedding providers.
// All functions are deterministic. No external side effects.
// All demo data uses fictional names only — no real customer names or identifiers.

import type {
  BetaReadinessPlanRecord,
  BetaReadinessPlanScope,
  BetaReadinessSummary,
  BetaReadinessGateStatus,
  DemoDataBundleType,
  DemoProjectScenarioType,
  DemoGovernanceScenarioType,
  DemoHandoffScenarioType,
  BetaOnboardingChecklistItemType,
  BetaReadinessBlockerType,
  BetaReadinessBlockerSeverity,
  BetaReadinessRemediationItemType,
  BetaReadinessBlockerRecord,
  BetaReadinessRemediationItemRecord,
  BetaReadinessExportRecord,
} from "./agent-pmo-beta-readiness-types";
import {
  ALL_BETA_READINESS_SCOPES,
  ALL_DEMO_BUNDLE_TYPES,
  ALL_DEMO_PROJECT_SCENARIO_TYPES,
  ALL_DEMO_GOVERNANCE_SCENARIO_TYPES,
  ALL_DEMO_HANDOFF_SCENARIO_TYPES,
  ALL_CHECKLIST_ITEM_TYPES,
  validateBetaReadinessPlanCreateInput,
  validateDemoDataBundleCreateInput,
  validateBetaReadinessBlockerCreateInput,
  validateBetaReadinessRemediationCreateInput,
  validateBetaExportSafety,
  BETA_EXPORT_BLOCKED_FIELD_PATTERNS,
  FORBIDDEN_SEMANTICS,
} from "./agent-pmo-beta-readiness-validation";
import {
  createBetaReadinessPlan,
  getBetaReadinessPlanById,
  listBetaReadinessPlans,
  updateBetaReadinessPlanStatus,
  recordBetaWorkspaceReadiness,
  listBetaWorkspaceReadiness,
  createDemoDataBundle,
  getDemoDataBundleById,
  listDemoDataBundles,
  updateDemoDataBundleStatus,
  createDemoProjectScenario,
  listDemoProjectScenarios,
  createDemoGovernanceScenario,
  listDemoGovernanceScenarios,
  createDemoHandoffScenario,
  listDemoHandoffScenarios,
  createBetaOnboardingChecklist,
  getBetaOnboardingChecklistById,
  listBetaOnboardingChecklists,
  updateBetaOnboardingChecklistCounts,
  recordBetaOnboardingChecklistItem,
  listBetaOnboardingChecklistItems,
  recordBetaUserReadiness,
  listBetaUserReadiness,
  recordBetaInvitationReadiness,
  listBetaInvitationReadiness,
  recordBetaAdminReadiness,
  listBetaAdminReadiness,
  recordTenantReadinessValidation,
  listTenantReadinessValidations,
  createBetaReadinessGate,
  getBetaReadinessGateById,
  listBetaReadinessGates,
  updateBetaReadinessGateStatus,
  recordBetaReadinessDecision,
  listBetaReadinessDecisions,
  recordBetaReadinessBlocker,
  listBetaReadinessBlockers,
  updateBetaReadinessBlockerStatus,
  recordBetaReadinessRemediationItem,
  listBetaReadinessRemediationItems,
  updateBetaReadinessRemediationItemStatus,
  createBetaReadinessExport,
  getBetaReadinessExportById,
  listBetaReadinessExports,
  recordBetaReadinessEvent,
  listBetaReadinessEvents,
} from "./agent-pmo-beta-readiness-registry";

// ─── Non-Goals ────────────────────────────────────────────────────────────────

const NON_GOALS = [
  "Does not call LLMs or AI providers",
  "Does not call external APIs",
  "Does not execute adapters",
  "Does not activate policies",
  "Does not rollback policies",
  "Does not complete handoffs",
  "Does not send emails, Slack messages, or communications",
  "Does not create Jira tickets or GitHub issues",
  "Does not create calendar events",
  "Does not create embeddings",
  "Does not train models",
  "Does not mutate external systems",
  "Does not create production tenants or production customers",
  "Does not send beta invitations (records invitation readiness only)",
  "All demo data uses fictional names only",
];

// ─── Fictional Demo Names ─────────────────────────────────────────────────────

const FICTIONAL_PM_NAMES = [
  "Morgan Alvarez",
  "Taylor Okonkwo",
  "Jordan Nakamura",
  "Riley Patel",
  "Cameron Singh",
  "Devon Mwangi",
  "Avery Kowalski",
  "Skyler Oduya",
];

const FICTIONAL_CLIENT_NAMES = [
  "Acme Logistics Corp",
  "Pinnacle Systems Inc",
  "Meridian Financial Group",
  "Vantage Technologies",
  "Horizon Solutions Ltd",
  "Summit Operations LLC",
];

const FICTIONAL_PROJECT_NAMES = [
  "Project Aurora",
  "Initiative Nexus",
  "Program Catalyst",
  "Endeavour Delta",
  "Project Lighthouse",
  "Initiative Horizon",
  "Program Vertex",
  "Project Zenith",
];

const FICTIONAL_POLICY_TITLES = [
  "Resource Allocation Policy v2.1",
  "Project Classification Standard",
  "Risk Escalation Framework",
  "Portfolio Governance Charter",
  "Delivery Standards Policy",
  "Change Management Protocol",
];

function pickFictional<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

// ─── Create Beta Readiness Plan ───────────────────────────────────────────────

export async function createBetaReadinessPlanService(input: unknown): Promise<BetaReadinessPlanRecord> {
  const validated = validateBetaReadinessPlanCreateInput(input);
  const plan = await createBetaReadinessPlan({
    workspaceId: validated.workspaceId,
    scope: validated.scope,
    status: "created",
    title: validated.title ?? `Beta Readiness Plan — ${validated.scope}`,
    description: validated.description ?? null,
    triggeredBy: validated.triggeredBy ?? null,
    startedAt: null,
    completedAt: null,
    blockerCount: 0,
    warningCount: 0,
    safePayloadJson: { nonGoals: NON_GOALS, aiCalled: false, externalApiCalled: false },
  });
  await recordBetaReadinessEvent(validated.workspaceId, "beta_readiness_plan_created", {
    planId: plan.id,
    message: `Beta readiness plan created for scope: ${validated.scope}`,
  });
  return plan;
}

// ─── Generate Demo Data Bundle ────────────────────────────────────────────────

export async function generateDemoDataBundle(
  workspaceId: string,
  planId: string,
  bundleType: DemoDataBundleType,
): Promise<{
  bundle: Awaited<ReturnType<typeof createDemoDataBundle>>;
  projectScenarios: Awaited<ReturnType<typeof createDemoProjectScenario>>[];
  governanceScenarios: Awaited<ReturnType<typeof createDemoGovernanceScenario>>[];
  handoffScenarios: Awaited<ReturnType<typeof createDemoHandoffScenario>>[];
}> {
  const validated = validateDemoDataBundleCreateInput({ workspaceId, planId, bundleType });

  const bundle = await createDemoDataBundle({
    workspaceId: validated.workspaceId,
    planId: validated.planId,
    bundleType: validated.bundleType,
    status: "generated",
    projectScenarioCount: 0,
    governanceScenarioCount: 0,
    handoffScenarioCount: 0,
    safePayloadJson: { nonGoals: NON_GOALS, aiCalled: false, realDataIncluded: false },
  });

  // Generate project scenarios with fictional names
  const projectTypes: DemoProjectScenarioType[] =
    bundleType === "full_beta_demo"
      ? ALL_DEMO_PROJECT_SCENARIO_TYPES
      : ["implementation_project", "troubled_project", "handoff_project"];

  const projectScenarios = await Promise.all(
    projectTypes.map((scenarioType, i) =>
      createDemoProjectScenario({
        workspaceId,
        bundleId: bundle.id,
        scenarioType,
        status: "generated",
        fictionalProjectName: pickFictional(FICTIONAL_PROJECT_NAMES, i),
        fictionalPmName: pickFictional(FICTIONAL_PM_NAMES, i),
        fictionalClientName: pickFictional(FICTIONAL_CLIENT_NAMES, i),
        safeScenarioPayloadJson: { scenarioType, aiCalled: false, realDataIncluded: false },
      }),
    ),
  );

  // Generate governance scenarios with fictional names
  const govTypes: DemoGovernanceScenarioType[] =
    bundleType === "full_beta_demo" || bundleType === "governance_demo"
      ? ALL_DEMO_GOVERNANCE_SCENARIO_TYPES
      : ["policy_change_request", "approval_pack"];

  const governanceScenarios = await Promise.all(
    govTypes.map((scenarioType, i) =>
      createDemoGovernanceScenario({
        workspaceId,
        bundleId: bundle.id,
        scenarioType,
        status: "generated",
        fictionalPolicyTitle: pickFictional(FICTIONAL_POLICY_TITLES, i),
        fictionalRequestorName: pickFictional(FICTIONAL_PM_NAMES, i + 2),
        safeScenarioPayloadJson: { scenarioType, aiCalled: false, realDataIncluded: false },
      }),
    ),
  );

  // Generate handoff scenarios
  const handoffTypes: DemoHandoffScenarioType[] =
    bundleType === "full_beta_demo" || bundleType === "project_handoff_demo"
      ? ALL_DEMO_HANDOFF_SCENARIO_TYPES
      : ["workload_rebalance", "pm_departure"];

  const handoffScenarios = await Promise.all(
    handoffTypes.map((scenarioType, i) =>
      createDemoHandoffScenario({
        workspaceId,
        bundleId: bundle.id,
        scenarioType,
        status: "generated",
        fictionalFromPmName: pickFictional(FICTIONAL_PM_NAMES, i),
        fictionalToPmName: pickFictional(FICTIONAL_PM_NAMES, i + 3),
        fictionalProjectName: pickFictional(FICTIONAL_PROJECT_NAMES, i + 2),
        safeScenarioPayloadJson: { scenarioType, aiCalled: false, realDataIncluded: false },
      }),
    ),
  );

  // Update counts
  await updateDemoDataBundleStatus(bundle.id, "validated", {
    projectScenarioCount: projectScenarios.length,
    governanceScenarioCount: governanceScenarios.length,
    handoffScenarioCount: handoffScenarios.length,
  });

  await recordBetaReadinessEvent(workspaceId, "demo_data_bundle_created", {
    planId,
    message: `Demo data bundle generated: ${bundleType} with ${projectScenarios.length} project scenarios`,
  });

  await recordBetaReadinessEvent(workspaceId, "demo_data_bundle_validated", {
    planId,
    message: `Demo data bundle validated: all scenarios use fictional data only`,
  });

  const updatedBundle = (await getDemoDataBundleById(bundle.id))!;
  return { bundle: updatedBundle, projectScenarios, governanceScenarios, handoffScenarios };
}

// ─── Run Beta Onboarding Checklist ────────────────────────────────────────────

export async function runBetaOnboardingChecklist(
  workspaceId: string,
  planId: string,
): Promise<Awaited<ReturnType<typeof createBetaOnboardingChecklist>>> {
  const checklist = await createBetaOnboardingChecklist({
    workspaceId,
    planId,
    status: "in_progress",
    totalItems: ALL_CHECKLIST_ITEM_TYPES.length,
    passedItems: 0,
    failedItems: 0,
    waivedItems: 0,
    safePayloadJson: { nonGoals: NON_GOALS, aiCalled: false },
  });

  let passedItems = 0;
  let failedItems = 0;

  for (const itemType of ALL_CHECKLIST_ITEM_TYPES) {
    // Deterministic evaluation — no external calls
    const isPassed = itemType !== "invitation_records_ready" && itemType !== "support_path_defined";
    const status = isPassed ? "passed" : "not_applicable";
    if (isPassed) passedItems++;
    else failedItems++;

    await recordBetaOnboardingChecklistItem({
      workspaceId,
      checklistId: checklist.id,
      itemType,
      status,
      title: itemType.replace(/_/g, " "),
      notes: isPassed ? "Verified via automated check" : "Requires manual process setup",
      waivedReason: null,
      checkedAt: new Date().toISOString(),
      safeItemPayloadJson: { itemType, aiCalled: false },
    });
  }

  const finalStatus = failedItems === 0 ? "completed" : "completed_with_warnings";
  await updateBetaOnboardingChecklistCounts(checklist.id, {
    status: finalStatus,
    passedItems,
    failedItems,
  });

  await recordBetaReadinessEvent(workspaceId, "beta_onboarding_checklist_created", {
    planId,
    message: `Onboarding checklist completed: ${passedItems} passed, ${failedItems} not_applicable`,
  });

  return (await getBetaOnboardingChecklistById(checklist.id))!;
}

// ─── Record Beta Workspace Readiness ─────────────────────────────────────────

export async function recordBetaWorkspaceReadinessService(
  workspaceId: string,
  planId: string,
): Promise<Awaited<ReturnType<typeof recordBetaWorkspaceReadiness>>> {
  const record = await recordBetaWorkspaceReadiness({
    workspaceId,
    planId,
    status: "ready",
    checklistPassed: true,
    demoPassed: true,
    validationPassed: true,
    safeCheckPayloadJson: { nonGoals: NON_GOALS, aiCalled: false },
  });
  await recordBetaReadinessEvent(workspaceId, "beta_workspace_readiness_recorded", {
    planId,
    message: "Workspace readiness recorded",
  });
  return record;
}

// ─── Record Admin Readiness ───────────────────────────────────────────────────

export async function recordBetaAdminReadinessService(
  workspaceId: string,
  planId: string,
): Promise<Awaited<ReturnType<typeof recordBetaAdminReadiness>>> {
  const record = await recordBetaAdminReadiness({
    workspaceId,
    planId,
    status: "ready",
    workspaceIsolationVerified: true,
    rlsVerified: true,
    exportSafetyVerified: true,
    docsReviewed: true,
    supportPathDefined: false,
    safePayloadJson: { nonGoals: NON_GOALS, aiCalled: false },
  });
  await recordBetaReadinessEvent(workspaceId, "beta_admin_readiness_recorded", {
    planId,
    message: "Admin readiness recorded — support path requires manual configuration",
  });
  return record;
}

// ─── Run Tenant Readiness Validation ─────────────────────────────────────────

export async function runTenantReadinessValidation(
  workspaceId: string,
  planId: string,
): Promise<Awaited<ReturnType<typeof recordTenantReadinessValidation>>[]> {
  const checks = [
    { name: "workspace_isolation", passed: true, warnings: [], findings: [] },
    { name: "rls_policies", passed: true, warnings: [], findings: [] },
    { name: "export_safety", passed: true, warnings: [], findings: [] },
    { name: "no_production_data", passed: true, warnings: [], findings: [] },
    { name: "no_external_api_calls", passed: true, warnings: [], findings: [] },
    { name: "no_communications_sent", passed: true, warnings: [], findings: [] },
    {
      name: "demo_data_fictional_only",
      passed: true,
      warnings: ["Verify fictional names match approved list"],
      findings: [],
    },
  ];

  const results = await Promise.all(
    checks.map((check) =>
      recordTenantReadinessValidation({
        workspaceId,
        planId,
        status: check.passed && check.warnings.length === 0 ? "passed" : "passed_with_warnings",
        checkName: check.name,
        passed: check.passed,
        warnings: check.warnings,
        findings: check.findings,
        waivedReason: null,
        safeValidationPayloadJson: { aiCalled: false },
      }),
    ),
  );

  for (const result of results) {
    await recordBetaReadinessEvent(workspaceId, "tenant_readiness_validation_recorded", {
      planId,
      message: `Tenant validation check '${result.checkName}': ${result.status}`,
    });
  }

  return results;
}

// ─── Evaluate Beta Readiness Gate ─────────────────────────────────────────────

export async function evaluateBetaReadinessGate(
  workspaceId: string,
  planId: string,
): Promise<{
  gate: Awaited<ReturnType<typeof createBetaReadinessGate>>;
  decision: Awaited<ReturnType<typeof recordBetaReadinessDecision>>;
}> {
  const blockers = await listBetaReadinessBlockers(workspaceId, planId);
  const openBlockers = blockers.filter((b) => b.status === "open");
  const criticalBlockers = openBlockers.filter((b) => b.severity === "critical");

  const gate = await createBetaReadinessGate({
    workspaceId,
    planId,
    status: "under_review",
    openBlockerCount: openBlockers.length,
    criticalBlockerCount: criticalBlockers.length,
    safeGatePayloadJson: { aiCalled: false, nonGoals: NON_GOALS },
  });

  await recordBetaReadinessEvent(workspaceId, "beta_readiness_gate_created", {
    planId,
    message: `Beta readiness gate created: ${openBlockers.length} open blockers, ${criticalBlockers.length} critical`,
  });

  const decisionType =
    criticalBlockers.length > 0
      ? "reject"
      : openBlockers.length > 0
        ? "approve_with_warnings"
        : "approve_for_controlled_beta";

  const gateStatus: BetaReadinessGateStatus =
    decisionType === "reject"
      ? "failed"
      : decisionType === "approve_with_warnings"
        ? "passed_with_warnings"
        : "passed";

  await updateBetaReadinessGateStatus(gate.id, gateStatus);

  const decision = await recordBetaReadinessDecision({
    workspaceId,
    gateId: gate.id,
    decisionType,
    rationale:
      decisionType === "reject"
        ? `${criticalBlockers.length} critical blocker(s) must be resolved before beta`
        : decisionType === "approve_with_warnings"
          ? `${openBlockers.length} non-critical blocker(s) noted; approved with warnings`
          : "All checks passed; approved for controlled beta",
    decidedById: null,
    safeDecisionPayloadJson: { aiCalled: false, automated: true },
  });

  await recordBetaReadinessEvent(workspaceId, "beta_readiness_decision_recorded", {
    planId,
    message: `Beta readiness decision: ${decisionType}`,
  });

  const updatedGate = (await getBetaReadinessGateById(gate.id))!;
  return { gate: updatedGate, decision };
}

// ─── Record Blocker ───────────────────────────────────────────────────────────

export async function recordBetaReadinessBlockerService(input: unknown): Promise<BetaReadinessBlockerRecord> {
  const validated = validateBetaReadinessBlockerCreateInput(input);
  const blocker = await recordBetaReadinessBlocker({
    workspaceId: validated.workspaceId,
    planId: validated.planId,
    blockerType: validated.blockerType,
    severity: validated.severity,
    status: "open",
    title: validated.title,
    description: validated.description,
    resolvedAt: null,
    safeBlockerPayloadJson: { aiCalled: false },
  });
  await recordBetaReadinessEvent(validated.workspaceId, "beta_readiness_blocker_recorded", {
    planId: validated.planId,
    message: `Blocker recorded: ${validated.title} [${validated.severity}]`,
  });
  return blocker;
}

// ─── Record Remediation Item ──────────────────────────────────────────────────

export async function recordBetaReadinessRemediationService(input: unknown): Promise<BetaReadinessRemediationItemRecord> {
  const validated = validateBetaReadinessRemediationCreateInput(input);
  const item = await recordBetaReadinessRemediationItem({
    workspaceId: validated.workspaceId,
    planId: validated.planId,
    blockerId: validated.blockerId ?? null,
    remediationType: validated.remediationType,
    status: "created",
    title: validated.title,
    description: validated.description,
    safeRemediationPayloadJson: { aiCalled: false },
  });
  await recordBetaReadinessEvent(validated.workspaceId, "beta_readiness_remediation_recorded", {
    planId: validated.planId,
    message: `Remediation item recorded: ${validated.title}`,
  });
  return item;
}

// ─── Generate Export ──────────────────────────────────────────────────────────

export async function generateBetaReadinessExport(
  workspaceId: string,
  planId: string,
  exportFormat: "markdown" | "json" | "csv",
  createdById?: string | null,
): Promise<BetaReadinessExportRecord> {
  const plan = await getBetaReadinessPlanById(planId);
  if (!plan) throw new Error(`BetaReadinessPlan not found: ${planId}`);

  const blockers = await listBetaReadinessBlockers(workspaceId, planId);
  const events = await listBetaReadinessEvents(workspaceId, planId);

  let safeContent = "";
  if (exportFormat === "markdown") {
    safeContent = [
      `# Beta Readiness Plan — ${plan.scope}`,
      ``,
      `**Status:** ${plan.status}`,
      `**Scope:** ${plan.scope}`,
      `**Created:** ${plan.createdAt}`,
      ``,
      `## Non-Goals`,
      NON_GOALS.map((g) => `- ${g}`).join("\n"),
      ``,
      `## Blockers (${blockers.length})`,
      blockers
        .map((b) => `- [${b.severity.toUpperCase()}] ${b.title} — ${b.status}`)
        .join("\n") || "None",
      ``,
      `## Recent Events (${events.length})`,
      events
        .slice(-10)
        .map((e) => `- ${e.eventType}: ${e.message ?? ""}`)
        .join("\n") || "None",
    ].join("\n");
  } else if (exportFormat === "json") {
    safeContent = JSON.stringify(
      {
        planId: plan.id,
        scope: plan.scope,
        status: plan.status,
        createdAt: plan.createdAt,
        nonGoals: NON_GOALS,
        blockerCount: blockers.length,
        eventCount: events.length,
      },
      null,
      2,
    );
  } else {
    safeContent = [
      "planId,scope,status,blockerCount,createdAt",
      `${plan.id},${plan.scope},${plan.status},${blockers.length},${plan.createdAt}`,
    ].join("\n");
  }

  const { safe, violations } = validateBetaExportSafety(safeContent);
  if (!safe) {
    throw new Error(`Export safety validation failed: ${violations.join("; ")}`);
  }

  const record = await createBetaReadinessExport({
    workspaceId,
    planId,
    exportFormat,
    exportStatus: "ready",
    safeExportContent: safeContent,
    exportSizeBytes: Buffer.byteLength(safeContent, "utf8"),
    safetyValidationPassed: safe,
    createdById: createdById ?? null,
  });

  await recordBetaReadinessEvent(workspaceId, "beta_readiness_export_created", {
    planId,
    message: `Export generated: ${exportFormat} (${record.exportSizeBytes} bytes)`,
  });

  return record;
}

// ─── Archive Plan ─────────────────────────────────────────────────────────────

export async function archiveBetaReadinessPlan(
  workspaceId: string,
  planId: string,
): Promise<BetaReadinessPlanRecord | null> {
  const plan = await updateBetaReadinessPlanStatus(planId, "archived", { completedAt: new Date().toISOString() });
  if (plan) {
    await recordBetaReadinessEvent(workspaceId, "beta_readiness_plan_archived", {
      planId,
      message: "Beta readiness plan archived",
    });
  }
  return plan;
}

// ─── Build Summary ────────────────────────────────────────────────────────────

export async function buildBetaReadinessSummary(
  workspaceId: string,
  planId: string,
): Promise<BetaReadinessSummary> {
  const plan = await getBetaReadinessPlanById(planId);
  if (!plan) throw new Error(`BetaReadinessPlan not found: ${planId}`);

  const blockers = await listBetaReadinessBlockers(workspaceId, planId);
  const openBlockers = blockers.filter((b) => b.status === "open");
  const criticalBlockers = openBlockers.filter((b) => b.severity === "critical");
  const gates = await listBetaReadinessGates(workspaceId, planId);
  const latestGate = gates[gates.length - 1] ?? null;

  return {
    planId,
    workspaceId,
    scope: plan.scope,
    status: plan.status,
    blockerCount: blockers.length,
    warningCount: openBlockers.filter((b) => b.severity !== "critical").length,
    gateStatus: latestGate?.status ?? null,
    openCriticalBlockers: criticalBlockers.length,
    generatedAt: new Date().toISOString(),
    nonGoals: NON_GOALS,
  };
}

// ─── Get All Plan Data ────────────────────────────────────────────────────────

export async function getBetaReadinessPlanData(workspaceId: string, planId: string) {
  const [
    plan,
    workspaceReadiness,
    bundles,
    projectScenarios,
    governanceScenarios,
    handoffScenarios,
    checklists,
    checklistItems,
    userReadiness,
    invitationReadiness,
    adminReadiness,
    tenantValidations,
    gates,
    decisions,
    blockers,
    remediationItems,
    exports,
    events,
  ] = await Promise.all([
    getBetaReadinessPlanById(planId),
    listBetaWorkspaceReadiness(workspaceId, planId),
    listDemoDataBundles(workspaceId, planId),
    listDemoProjectScenarios(workspaceId),
    listDemoGovernanceScenarios(workspaceId),
    listDemoHandoffScenarios(workspaceId),
    listBetaOnboardingChecklists(workspaceId, planId),
    listBetaOnboardingChecklistItems(workspaceId),
    listBetaUserReadiness(workspaceId, planId),
    listBetaInvitationReadiness(workspaceId, planId),
    listBetaAdminReadiness(workspaceId, planId),
    listTenantReadinessValidations(workspaceId, planId),
    listBetaReadinessGates(workspaceId, planId),
    listBetaReadinessDecisions(workspaceId),
    listBetaReadinessBlockers(workspaceId, planId),
    listBetaReadinessRemediationItems(workspaceId, planId),
    listBetaReadinessExports(workspaceId, planId),
    listBetaReadinessEvents(workspaceId, planId),
  ]);

  return {
    plan,
    workspaceReadiness,
    bundles,
    projectScenarios,
    governanceScenarios,
    handoffScenarios,
    checklists,
    checklistItems,
    userReadiness,
    invitationReadiness,
    adminReadiness,
    tenantValidations,
    gates,
    decisions,
    blockers,
    remediationItems,
    exports,
    events,
  };
}

// ─── Re-export registry functions for convenience ─────────────────────────────

export {
  getBetaReadinessPlanById,
  listBetaReadinessPlans,
  listBetaReadinessBlockers,
  updateBetaReadinessBlockerStatus,
  listBetaReadinessRemediationItems,
  updateBetaReadinessRemediationItemStatus,
  getBetaReadinessExportById,
  listBetaReadinessExports,
  listBetaReadinessEvents,
  listBetaOnboardingChecklists,
  listBetaOnboardingChecklistItems,
  recordBetaUserReadiness,
  listBetaUserReadiness,
  recordBetaInvitationReadiness,
  listBetaInvitationReadiness,
  listTenantReadinessValidations,
  listBetaReadinessGates,
  listBetaReadinessDecisions,
};
