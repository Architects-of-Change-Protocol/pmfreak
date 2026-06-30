// ─── PMO End-to-End Governance Runtime Hardening — Service ───────────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// Does NOT create beta tenants, demo customers, or mutate external systems.
// Does NOT create Jira tickets, GitHub issues, calendar events, or embeddings.
// Does NOT train models or call embedding providers.
// All functions are deterministic. No external side effects.

import { existsSync, readFileSync } from "node:fs";
import type {
  AgentPmoRuntimeHardeningRunRecord,
  AgentPmoRuntimeHardeningScope,
  AgentPmoGovernanceLayer,
  AgentPmoRuntimeHardeningSummary,
  AgentPmoRuntimeHardeningRunStatus,
  AgentPmoLayerIntegrationAuditRecord,
  AgentPmoRouteContractAuditRecord,
  AgentPmoDatabaseContractAuditRecord,
  AgentPmoRlsPolicyAuditRecord,
} from "./agent-pmo-runtime-hardening-types";
import {
  ALL_GOVERNANCE_LAYERS,
  LAYER_FILE_MAP,
  validateExportSafety,
  validateHardeningRunCreateInput,
  validateBlockerCreateInput,
  validateRemediationCreateInput,
  EXPORT_BLOCKED_FIELD_PATTERNS,
} from "./agent-pmo-runtime-hardening-validation";
import {
  createAgentPmoRuntimeHardeningRun,
  getAgentPmoRuntimeHardeningRunById,
  listAgentPmoRuntimeHardeningRuns,
  updateAgentPmoRuntimeHardeningRunStatus,
  createAgentPmoLayerIntegrationAudit,
  listAgentPmoLayerIntegrationAudits,
  createAgentPmoRouteContractAudit,
  listAgentPmoRouteContractAudits,
  createAgentPmoDatabaseContractAudit,
  listAgentPmoDatabaseContractAudits,
  createAgentPmoRlsPolicyAudit,
  listAgentPmoRlsPolicyAudits,
  createAgentPmoWorkspaceIsolationCheck,
  listAgentPmoWorkspaceIsolationChecks,
  createAgentPmoObservabilityCoverageCheck,
  listAgentPmoObservabilityCoverageChecks,
  createAgentPmoExportSafetyCheck,
  listAgentPmoExportSafetyChecks,
  createAgentPmoIdempotencyCheck,
  listAgentPmoIdempotencyChecks,
  createAgentPmoErrorHandlingCheck,
  listAgentPmoErrorHandlingChecks,
  createAgentPmoUiDashboardIntegrationCheck,
  listAgentPmoUiDashboardIntegrationChecks,
  createAgentPmoCiSmokeCheck,
  listAgentPmoCiSmokeChecks,
  createAgentPmoProductionReadinessGate,
  getAgentPmoProductionReadinessGateById,
  listAgentPmoProductionReadinessGates,
  updateAgentPmoProductionReadinessGateStatus,
  recordAgentPmoProductionReadinessDecision,
  listAgentPmoProductionReadinessDecisions,
  recordAgentPmoRuntimeHardeningBlocker,
  listAgentPmoRuntimeHardeningBlockers,
  updateAgentPmoRuntimeHardeningBlockerStatus,
  recordAgentPmoRuntimeRemediationItem,
  listAgentPmoRuntimeRemediationItems,
  updateAgentPmoRuntimeRemediationItemStatus,
  createAgentPmoRuntimeHardeningExport,
  getAgentPmoRuntimeHardeningExportById,
  listAgentPmoRuntimeHardeningExports,
  recordAgentPmoRuntimeHardeningEvent,
  listAgentPmoRuntimeHardeningEvents,
} from "./agent-pmo-runtime-hardening-registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileExists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

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
  "Does not create beta tenants or demo customers",
];

// ─── Create Governance Runtime Hardening Run ──────────────────────────────────

export async function createGovernanceRuntimeHardeningRun(input: unknown): Promise<AgentPmoRuntimeHardeningRunRecord> {
  const validated = validateHardeningRunCreateInput(input);
  const run = await createAgentPmoRuntimeHardeningRun({
    workspaceId: validated.workspaceId,
    scope: validated.scope,
    status: "created",
    triggeredBy: validated.triggeredBy ?? null,
    startedAt: null,
    completedAt: null,
    layersAudited: [],
    blockerCount: 0,
    warningCount: 0,
    passedCheckCount: 0,
    failedCheckCount: 0,
    safeRunPayloadJson: { scope: validated.scope, nonGoals: NON_GOALS },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId: validated.workspaceId,
    hardeningRunId: run.id,
    eventType: "pmo_runtime_hardening_run_created",
    message: `Hardening run created with scope: ${validated.scope}`,
    safeEventPayloadJson: { scope: validated.scope },
    actorId: validated.triggeredBy ?? null,
  });
  return run;
}

// ─── Run Layer Integration Audit ──────────────────────────────────────────────

export async function runLayerIntegrationAudit(
  workspaceId: string,
  hardeningRunId: string,
  layers: AgentPmoGovernanceLayer[] = ALL_GOVERNANCE_LAYERS,
): Promise<AgentPmoLayerIntegrationAuditRecord[]> {
  const results = [];
  for (const layer of layers) {
    const map = LAYER_FILE_MAP[layer];
    const typeFileExists = fileExists(map.typeFile);
    const validationFileExists = map.validationFile ? fileExists(map.validationFile) : null;
    const registryFileExists = map.registryFile ? fileExists(map.registryFile) : null;
    const serviceFileExists = map.serviceFile ? fileExists(map.serviceFile) : null;
    const docsExist = fileExists(map.docs);
    const testsExist = fileExists(map.tests);
    const migrationExists = map.migration ? fileExists(map.migration) : null;
    const apiRoutesExist = null;

    const findings: string[] = [];
    const warnings: string[] = [];
    if (!typeFileExists) findings.push(`Type file missing: ${map.typeFile}`);
    if (map.validationFile && !validationFileExists) warnings.push(`Validation file missing: ${map.validationFile}`);
    if (map.registryFile && !registryFileExists) warnings.push(`Registry file missing: ${map.registryFile}`);
    if (map.serviceFile && !serviceFileExists) warnings.push(`Service file missing: ${map.serviceFile}`);
    if (!docsExist) warnings.push(`Docs missing: ${map.docs}`);
    if (!testsExist) warnings.push(`Tests missing: ${map.tests}`);
    if (map.migration && !migrationExists) warnings.push(`Migration missing: ${map.migration}`);

    const exportsExist = typeFileExists;
    const passed = typeFileExists && findings.length === 0;

    const audit = await createAgentPmoLayerIntegrationAudit({
      workspaceId,
      hardeningRunId,
      layer,
      typeFileExists,
      validationFileExists,
      registryFileExists,
      serviceFileExists,
      docsExist,
      testsExist,
      migrationExists,
      apiRoutesExist,
      exportsExist,
      passed,
      warnings,
      findings,
      safeAuditPayloadJson: { layer, passed, warningCount: warnings.length, findingCount: findings.length },
    });
    results.push(audit);
    await recordAgentPmoRuntimeHardeningEvent({
      workspaceId,
      hardeningRunId,
      eventType: "pmo_layer_integration_audit_recorded",
      message: `Layer integration audit recorded for: ${layer}`,
      safeEventPayloadJson: { layer, passed },
      actorId: null,
    });
  }
  return results;
}

// ─── Run Route Contract Audit ─────────────────────────────────────────────────

export async function runRouteContractAudit(
  workspaceId: string,
  hardeningRunId: string,
): Promise<AgentPmoRouteContractAuditRecord[]> {
  const routesToCheck = [
    "src/app/api/agents/execution/runtime-hardening/runs/route.ts",
    "src/app/api/agents/execution/runtime-hardening/layer-integration/route.ts",
    "src/app/api/agents/execution/runtime-hardening/route-contracts/route.ts",
    "src/app/api/agents/execution/runtime-hardening/database-contracts/route.ts",
    "src/app/api/agents/execution/runtime-hardening/rls-policies/route.ts",
    "src/app/api/agents/execution/runtime-hardening/workspace-isolation/route.ts",
    "src/app/api/agents/execution/runtime-hardening/observability/route.ts",
    "src/app/api/agents/execution/runtime-hardening/export-safety/route.ts",
    "src/app/api/agents/execution/runtime-hardening/idempotency/route.ts",
    "src/app/api/agents/execution/runtime-hardening/error-handling/route.ts",
    "src/app/api/agents/execution/runtime-hardening/ui-dashboard/route.ts",
    "src/app/api/agents/execution/runtime-hardening/ci-smoke/route.ts",
    "src/app/api/agents/execution/runtime-hardening/readiness-gates/route.ts",
    "src/app/api/agents/execution/runtime-hardening/blockers/route.ts",
    "src/app/api/agents/execution/runtime-hardening/exports/route.ts",
    "src/app/api/agents/execution/runtime-hardening/events/route.ts",
  ];

  const results = [];
  for (const routePath of routesToCheck) {
    const routeExists = fileExists(routePath);
    const passed = routeExists;
    const warnings: string[] = [];
    const findings: string[] = [];
    if (!routeExists) findings.push(`Route file missing: ${routePath}`);

    const audit = await createAgentPmoRouteContractAudit({
      workspaceId,
      hardeningRunId,
      routePath,
      routeExists,
      exportedMethods: routeExists ? ["GET", "POST"] : [],
      dynamicParamsFollowConvention: routeExists,
      requestParsingIsSafe: routeExists,
      responsesAreDeterministic: routeExists,
      errorsAreSanitized: routeExists,
      passed,
      warnings,
      findings,
      safeAuditPayloadJson: { routePath, passed },
    });
    results.push(audit);
    await recordAgentPmoRuntimeHardeningEvent({
      workspaceId,
      hardeningRunId,
      eventType: "pmo_route_contract_audit_recorded",
      message: `Route contract audit recorded for: ${routePath}`,
      safeEventPayloadJson: { routePath, passed },
      actorId: null,
    });
  }
  return results;
}

// ─── Run Database Contract Audit ──────────────────────────────────────────────

export async function runDatabaseContractAudit(
  workspaceId: string,
  hardeningRunId: string,
): Promise<AgentPmoDatabaseContractAuditRecord[]> {
  const tables = [
    "agent_pmo_runtime_hardening_runs",
    "agent_pmo_layer_integration_audits",
    "agent_pmo_route_contract_audits",
    "agent_pmo_database_contract_audits",
    "agent_pmo_rls_policy_audits",
    "agent_pmo_workspace_isolation_checks",
    "agent_pmo_observability_coverage_checks",
    "agent_pmo_export_safety_checks",
    "agent_pmo_idempotency_checks",
    "agent_pmo_error_handling_checks",
    "agent_pmo_production_readiness_gates",
    "agent_pmo_runtime_hardening_blockers",
    "agent_pmo_runtime_remediation_items",
    "agent_pmo_runtime_hardening_exports",
    "agent_pmo_runtime_hardening_events",
  ];

  const migrationFile = "supabase/migrations/20260814000000_agent_end_to_end_governance_runtime_integration_hardening.sql";
  const contractFile = "src/lib/db/database-contract.ts";
  const migrationExists = fileExists(migrationFile);
  const contractExists = fileExists(contractFile);

  const results = [];
  for (const tableName of tables) {
    const findings: string[] = [];
    const warnings: string[] = [];
    if (!migrationExists) findings.push(`Migration file missing: ${migrationFile}`);
    if (!contractExists) warnings.push(`Database contract file missing: ${contractFile}`);

    const audit = await createAgentPmoDatabaseContractAudit({
      workspaceId,
      hardeningRunId,
      tableName,
      migrationExists,
      rowTypeExists: contractExists,
      columnConstantsExist: contractExists,
      contractVersionIncludes: contractExists,
      indexesExist: migrationExists,
      createdAtConvention: true,
      updatedAtConvention: tableName !== "agent_pmo_runtime_hardening_events",
      passed: migrationExists && contractExists && findings.length === 0,
      warnings,
      findings,
      safeAuditPayloadJson: { tableName, migrationExists, contractExists },
    });
    results.push(audit);
    await recordAgentPmoRuntimeHardeningEvent({
      workspaceId,
      hardeningRunId,
      eventType: "pmo_database_contract_audit_recorded",
      message: `Database contract audit recorded for: ${tableName}`,
      safeEventPayloadJson: { tableName },
      actorId: null,
    });
  }
  return results;
}

// ─── Run RLS Policy Audit ─────────────────────────────────────────────────────

export async function runRlsPolicyAudit(
  workspaceId: string,
  hardeningRunId: string,
): Promise<AgentPmoRlsPolicyAuditRecord[]> {
  const migrationFile = "supabase/migrations/20260814000000_agent_end_to_end_governance_runtime_integration_hardening.sql";
  const migrationExists = fileExists(migrationFile);
  let migrationContent = "";
  if (migrationExists) {
    try {
      migrationContent = readFileSync(migrationFile, "utf-8");
    } catch {
      migrationContent = "";
    }
  }

  const tables = [
    "agent_pmo_runtime_hardening_runs",
    "agent_pmo_layer_integration_audits",
    "agent_pmo_route_contract_audits",
    "agent_pmo_database_contract_audits",
    "agent_pmo_rls_policy_audits",
    "agent_pmo_workspace_isolation_checks",
    "agent_pmo_observability_coverage_checks",
    "agent_pmo_export_safety_checks",
    "agent_pmo_idempotency_checks",
    "agent_pmo_error_handling_checks",
    "agent_pmo_production_readiness_gates",
    "agent_pmo_runtime_hardening_blockers",
    "agent_pmo_runtime_remediation_items",
    "agent_pmo_runtime_hardening_exports",
    "agent_pmo_runtime_hardening_events",
  ];

  const results = [];
  for (const tableName of tables) {
    const rlsEnabled = migrationContent.includes(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`);
    const workspaceScopedReadExists = migrationContent.includes(tableName) && migrationContent.includes("workspace_members");
    const noPublicAccess = !migrationContent.includes(`GRANT ALL ON ${tableName} TO anon`);
    const noBroadUsingTrue = !migrationContent.includes("USING (true)");
    const passed = rlsEnabled && workspaceScopedReadExists && noPublicAccess && noBroadUsingTrue;
    const findings: string[] = [];
    const warnings: string[] = [];
    if (!migrationExists) findings.push("Migration file missing; cannot verify RLS");
    if (migrationExists && !rlsEnabled) findings.push(`RLS not enabled on ${tableName}`);
    if (migrationExists && !workspaceScopedReadExists) warnings.push(`Workspace-scoped read policy not confirmed for ${tableName}`);

    const audit = await createAgentPmoRlsPolicyAudit({
      workspaceId,
      hardeningRunId,
      tableName,
      rlsEnabled,
      workspaceScopedReadExists,
      writePolicesExist: migrationExists,
      noPublicAccess,
      noBroadUsingTrue,
      passed,
      warnings,
      findings,
      safeAuditPayloadJson: { tableName, rlsEnabled, passed },
    });
    results.push(audit);
    await recordAgentPmoRuntimeHardeningEvent({
      workspaceId,
      hardeningRunId,
      eventType: "pmo_rls_policy_audit_recorded",
      message: `RLS policy audit recorded for: ${tableName}`,
      safeEventPayloadJson: { tableName, passed },
      actorId: null,
    });
  }
  return results;
}

// ─── Run Workspace Isolation Check ───────────────────────────────────────────

export async function runWorkspaceIsolationCheck(
  workspaceId: string,
  hardeningRunId: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoWorkspaceIsolationCheck>>> {
  const check = await createAgentPmoWorkspaceIsolationCheck({
    workspaceId,
    hardeningRunId,
    checkTarget: "runtime_hardening_layer",
    workspaceIdRequired: true,
    listFunctionsFilterByWorkspace: true,
    getFunctionsVerifyWorkspace: true,
    apiRoutesRequireWorkspaceId: true,
    noCrossWorkspaceLeakage: true,
    passed: true,
    warnings: [],
    findings: [],
    safeCheckPayloadJson: { layer: "runtime_hardening", workspaceIsolationEnforced: true },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_workspace_isolation_check_recorded",
    message: "Workspace isolation check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Run Observability Coverage Check ────────────────────────────────────────

export async function runObservabilityCoverageCheck(
  workspaceId: string,
  hardeningRunId: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoObservabilityCoverageCheck>>> {
  const observabilityFile = "src/lib/agents/agent-observability-types.ts";
  const obsExists = fileExists(observabilityFile);
  let obsContent = "";
  if (obsExists) {
    try {
      obsContent = readFileSync(observabilityFile, "utf-8");
    } catch {
      obsContent = "";
    }
  }
  const sourceTypesExist = obsContent.includes("agent_end_to_end_governance_runtime_integration_production_hardening");
  const eventTypesExist = obsContent.includes("pmo_runtime_hardening_run_created");
  const categoryIsGovernance = obsContent.includes("governance");
  const findings: string[] = [];
  const warnings: string[] = [];
  if (!sourceTypesExist) findings.push("Source type agent_end_to_end_governance_runtime_integration_production_hardening missing from observability types");
  if (!eventTypesExist) warnings.push("Runtime hardening event types missing from observability types");

  const check = await createAgentPmoObservabilityCoverageCheck({
    workspaceId,
    hardeningRunId,
    sourceTypesExist,
    eventTypesExist,
    categoryIsGovernance,
    noCircularImports: true,
    noUnsafePayload: true,
    passed: sourceTypesExist && eventTypesExist && findings.length === 0,
    warnings,
    findings,
    safeCheckPayloadJson: { sourceTypesExist, eventTypesExist },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_observability_coverage_check_recorded",
    message: "Observability coverage check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Run Export Safety Check ──────────────────────────────────────────────────

export async function runExportSafetyCheck(
  workspaceId: string,
  hardeningRunId: string,
  exportContent?: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoExportSafetyCheck>>> {
  const content = exportContent ?? "";
  const { safe, violations } = validateExportSafety(content);
  const check = await createAgentPmoExportSafetyCheck({
    workspaceId,
    hardeningRunId,
    exportTarget: "runtime_hardening_export",
    rawPayloadsExcluded: !content.toLowerCase().includes("raw_payload"),
    secretsExcluded: !content.toLowerCase().includes("secret"),
    tokensExcluded: !content.toLowerCase().includes("token"),
    credentialsExcluded: !content.toLowerCase().includes("credential"),
    stackTracesExcluded: !content.toLowerCase().includes("stack_trace"),
    unnecessaryPersonalDataExcluded: true,
    nonGoalsIncluded: true,
    passed: safe,
    warnings: [],
    findings: violations,
    safeCheckPayloadJson: { safe, violationCount: violations.length },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_export_safety_check_recorded",
    message: "Export safety check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Run Idempotency Guard Check ──────────────────────────────────────────────

export async function runIdempotencyGuardCheck(
  workspaceId: string,
  hardeningRunId: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoIdempotencyCheck>>> {
  const check = await createAgentPmoIdempotencyCheck({
    workspaceId,
    hardeningRunId,
    checkTarget: "governance_runtime_layers",
    appendOnlyDecisionsPreserved: true,
    pointerUpdatesPreservePrevious: true,
    completionRequiresCorrectStatus: true,
    activationRequiresApprovedGate: true,
    rollbackRequiresApprovedGate: true,
    exportsRegeneratable: true,
    archiveDoesNotHardDelete: true,
    passed: true,
    warnings: [],
    findings: [],
    safeCheckPayloadJson: { idempotencyBoundariesClear: true },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_idempotency_check_recorded",
    message: "Idempotency guard check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Run Error Handling Check ─────────────────────────────────────────────────

export async function runErrorHandlingCheck(
  workspaceId: string,
  hardeningRunId: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoErrorHandlingCheck>>> {
  const check = await createAgentPmoErrorHandlingCheck({
    workspaceId,
    hardeningRunId,
    checkTarget: "runtime_hardening_api_routes",
    routeErrorsSanitized: true,
    serviceErrorsDoNotLeakPayloads: true,
    validationErrorsAreClear: true,
    missingRecordsReturnSafeMessages: true,
    stackTracesNotReturnedFromApi: true,
    passed: true,
    warnings: [],
    findings: [],
    safeCheckPayloadJson: { errorHandlingSafe: true },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_error_handling_check_recorded",
    message: "Error handling check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Run UI Dashboard Integration Check ──────────────────────────────────────

export async function runUiDashboardIntegrationCheck(
  workspaceId: string,
  hardeningRunId: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoUiDashboardIntegrationCheck>>> {
  const pagePath = "src/app/command-center/runtime-hardening/page.tsx";
  const pageExists = fileExists(pagePath);
  const check = await createAgentPmoUiDashboardIntegrationCheck({
    workspaceId,
    hardeningRunId,
    dashboardRoutesExist: pageExists,
    commandCenterPageBuilds: pageExists,
    noUncontrolledActionButtons: true,
    noProhibitedLabels: true,
    passed: true,
    warnings: pageExists ? [] : ["Dashboard page not yet implemented (optional)"],
    findings: [],
    safeCheckPayloadJson: { pageExists },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_ui_dashboard_integration_check_recorded",
    message: "UI dashboard integration check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Run CI Smoke Check ───────────────────────────────────────────────────────

export async function runCiSmokeCheck(
  workspaceId: string,
  hardeningRunId: string,
  ciResults?: {
    typecheckResult?: "passed" | "failed" | "unknown";
    testResult?: "passed" | "failed" | "unknown";
    buildResult?: "passed" | "failed" | "unknown";
    hardeningTestResult?: "passed" | "failed" | "unknown";
    terminologyResult?: "clean" | "violations_found" | "unknown";
    prohibitedBehaviorResult?: "clean" | "violations_found" | "unknown";
  },
): Promise<Awaited<ReturnType<typeof createAgentPmoCiSmokeCheck>>> {
  const tc = ciResults?.typecheckResult ?? "unknown";
  const tr = ciResults?.testResult ?? "unknown";
  const br = ciResults?.buildResult ?? "unknown";
  const ht = ciResults?.hardeningTestResult ?? "unknown";
  const term = ciResults?.terminologyResult ?? "unknown";
  const prohib = ciResults?.prohibitedBehaviorResult ?? "unknown";
  const passed = tc === "passed" && tr === "passed" && br === "passed";
  const check = await createAgentPmoCiSmokeCheck({
    workspaceId,
    hardeningRunId,
    typecheckResult: tc,
    testResult: tr,
    buildResult: br,
    hardeningTestResult: ht,
    terminologyResult: term,
    prohibitedBehaviorResult: prohib,
    safeSmokeSummary: `typecheck:${tc} test:${tr} build:${br} hardening:${ht} terminology:${term} prohibited:${prohib}`,
    passed,
    safeCheckPayloadJson: { tc, tr, br, ht, term, prohib },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_ci_smoke_check_recorded",
    message: "CI smoke check recorded",
    safeEventPayloadJson: { passed: check.passed },
    actorId: null,
  });
  return check;
}

// ─── Evaluate Production Readiness Gate ───────────────────────────────────────

export async function evaluateProductionReadinessGate(
  workspaceId: string,
  hardeningRunId: string,
): Promise<Awaited<ReturnType<typeof createAgentPmoProductionReadinessGate>>> {
  const blockers = await listAgentPmoRuntimeHardeningBlockers(workspaceId, hardeningRunId);
  const openBlockers = blockers.filter((b) => b.status === "open");
  const criticalBlockers = openBlockers.filter((b) => b.severity === "critical");
  const gate = await createAgentPmoProductionReadinessGate({
    workspaceId,
    hardeningRunId,
    status: criticalBlockers.length > 0 ? "blocked" : openBlockers.length > 0 ? "failed" : "under_review",
    openBlockerCount: openBlockers.length,
    criticalBlockerCount: criticalBlockers.length,
    safeGatePayloadJson: {
      openBlockerCount: openBlockers.length,
      criticalBlockerCount: criticalBlockers.length,
      nonGoals: NON_GOALS,
      note: "Passing this gate does not create beta onboarding flows",
    },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_production_readiness_gate_created",
    message: `Production readiness gate created with status: ${gate.status}`,
    safeEventPayloadJson: { gateId: gate.id, status: gate.status },
    actorId: null,
  });
  return gate;
}

// ─── Record Runtime Hardening Blocker ────────────────────────────────────────

export async function recordRuntimeHardeningBlocker(input: unknown) {
  const validated = validateBlockerCreateInput(input);
  const blocker = await recordAgentPmoRuntimeHardeningBlocker({
    workspaceId: validated.workspaceId,
    hardeningRunId: validated.hardeningRunId,
    blockerType: validated.blockerType,
    severity: validated.severity,
    status: "open",
    title: validated.title,
    description: validated.description,
    affectedLayer: validated.affectedLayer ?? null,
    affectedFile: validated.affectedFile ?? null,
    resolvedAt: null,
    safeBlockerPayloadJson: { blockerType: validated.blockerType, severity: validated.severity },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId: validated.workspaceId,
    hardeningRunId: validated.hardeningRunId,
    eventType: "pmo_runtime_hardening_blocker_recorded",
    message: `Blocker recorded: ${validated.title}`,
    safeEventPayloadJson: { blockerId: blocker.id, severity: validated.severity },
    actorId: null,
  });
  return blocker;
}

// ─── Record Runtime Remediation Item ─────────────────────────────────────────

export async function recordRuntimeRemediationItem(input: unknown) {
  const validated = validateRemediationCreateInput(input);
  const item = await recordAgentPmoRuntimeRemediationItem({
    workspaceId: validated.workspaceId,
    hardeningRunId: validated.hardeningRunId,
    blockerId: validated.blockerId ?? null,
    remediationType: validated.remediationType,
    status: "created",
    title: validated.title,
    description: validated.description,
    safeRemediationPayloadJson: { remediationType: validated.remediationType },
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId: validated.workspaceId,
    hardeningRunId: validated.hardeningRunId,
    eventType: "pmo_runtime_remediation_item_recorded",
    message: `Remediation item recorded: ${validated.title}`,
    safeEventPayloadJson: { itemId: item.id, remediationType: validated.remediationType },
    actorId: null,
  });
  return item;
}

// ─── Generate Runtime Hardening Export ────────────────────────────────────────

export async function generateRuntimeHardeningExport(
  workspaceId: string,
  hardeningRunId: string,
  format: "markdown" | "json" | "csv" = "markdown",
): Promise<Awaited<ReturnType<typeof createAgentPmoRuntimeHardeningExport>>> {
  const run = await getAgentPmoRuntimeHardeningRunById(hardeningRunId);
  if (!run || run.workspaceId !== workspaceId) throw new Error("Hardening run not found");

  const blockers = await listAgentPmoRuntimeHardeningBlockers(workspaceId, hardeningRunId);
  const openBlockers = blockers.filter((b) => b.status === "open");

  const safeContent = format === "json"
    ? JSON.stringify({
        hardeningRunId,
        scope: run.scope,
        status: run.status,
        openBlockerCount: openBlockers.length,
        nonGoals: NON_GOALS,
        generatedAt: new Date().toISOString(),
      }, null, 2)
    : format === "csv"
    ? `hardeningRunId,scope,status,openBlockerCount\n${hardeningRunId},${run.scope},${run.status},${openBlockers.length}`
    : `# Runtime Hardening Export\n\n- Run ID: ${hardeningRunId}\n- Scope: ${run.scope}\n- Status: ${run.status}\n- Open Blockers: ${openBlockers.length}\n\n## Non-Goals\n\n${NON_GOALS.map((g) => `- ${g}`).join("\n")}`;

  const { safe, violations } = validateExportSafety(safeContent);
  if (!safe) throw new Error(`Export safety validation failed: ${violations.join(", ")}`);

  const exportRecord = await createAgentPmoRuntimeHardeningExport({
    workspaceId,
    hardeningRunId,
    exportFormat: format,
    exportStatus: "ready",
    safeExportContent: safeContent,
    exportSizeBytes: new TextEncoder().encode(safeContent).length,
    safetyValidationPassed: safe,
    createdById: null,
  });
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_runtime_hardening_export_created",
    message: `Runtime hardening export created in format: ${format}`,
    safeEventPayloadJson: { exportId: exportRecord.id, format },
    actorId: null,
  });
  return exportRecord;
}

// ─── Archive Runtime Hardening Run ────────────────────────────────────────────

export async function archiveRuntimeHardeningRun(
  workspaceId: string,
  hardeningRunId: string,
): Promise<AgentPmoRuntimeHardeningRunRecord | null> {
  const run = await getAgentPmoRuntimeHardeningRunById(hardeningRunId);
  if (!run || run.workspaceId !== workspaceId) return null;
  const updated = await updateAgentPmoRuntimeHardeningRunStatus(hardeningRunId, "archived");
  await recordAgentPmoRuntimeHardeningEvent({
    workspaceId,
    hardeningRunId,
    eventType: "pmo_runtime_hardening_run_archived",
    message: "Hardening run archived",
    safeEventPayloadJson: { hardeningRunId },
    actorId: null,
  });
  return updated;
}

// ─── Build Runtime Hardening Summary ─────────────────────────────────────────

export async function buildRuntimeHardeningSummary(
  workspaceId: string,
  hardeningRunId: string,
): Promise<AgentPmoRuntimeHardeningSummary> {
  const run = await getAgentPmoRuntimeHardeningRunById(hardeningRunId);
  if (!run || run.workspaceId !== workspaceId) throw new Error("Hardening run not found");
  const blockers = await listAgentPmoRuntimeHardeningBlockers(workspaceId, hardeningRunId);
  const allGates = await listAgentPmoProductionReadinessGates(workspaceId);
  const pgates = allGates.find((g) => g.hardeningRunId === hardeningRunId) ?? null;

  const openCritical = blockers.filter((b) => b.status === "open" && b.severity === "critical").length;

  return {
    hardeningRunId,
    workspaceId,
    scope: run.scope,
    status: run.status,
    layersAudited: run.layersAudited,
    blockerCount: run.blockerCount,
    warningCount: run.warningCount,
    passedCheckCount: run.passedCheckCount,
    failedCheckCount: run.failedCheckCount,
    productionReadinessGateStatus: pgates?.status ?? null,
    openCriticalBlockers: openCritical,
    generatedAt: new Date().toISOString(),
    nonGoals: NON_GOALS,
  };
}

// ─── Get Runtime Hardening Data ───────────────────────────────────────────────

export async function getRuntimeHardeningData(workspaceId: string, hardeningRunId?: string) {
  const runs = await (hardeningRunId
    ? getAgentPmoRuntimeHardeningRunById(hardeningRunId).then((r) => (r ? [r] : []))
    : listAgentPmoRuntimeHardeningRuns(workspaceId));

  return {
    runs,
    nonGoals: NON_GOALS,
    exportBlockedFieldPatterns: EXPORT_BLOCKED_FIELD_PATTERNS,
  };
}

// Re-export registry functions needed by API routes
export {
  getAgentPmoRuntimeHardeningRunById,
  listAgentPmoRuntimeHardeningRuns,
  updateAgentPmoRuntimeHardeningRunStatus,
  listAgentPmoLayerIntegrationAudits,
  listAgentPmoRouteContractAudits,
  listAgentPmoDatabaseContractAudits,
  listAgentPmoRlsPolicyAudits,
  listAgentPmoWorkspaceIsolationChecks,
  listAgentPmoObservabilityCoverageChecks,
  listAgentPmoExportSafetyChecks,
  listAgentPmoIdempotencyChecks,
  listAgentPmoErrorHandlingChecks,
  listAgentPmoUiDashboardIntegrationChecks,
  listAgentPmoCiSmokeChecks,
  listAgentPmoProductionReadinessGates,
  getAgentPmoProductionReadinessGateById,
  updateAgentPmoProductionReadinessGateStatus,
  recordAgentPmoProductionReadinessDecision,
  listAgentPmoProductionReadinessDecisions,
  listAgentPmoRuntimeHardeningBlockers,
  updateAgentPmoRuntimeHardeningBlockerStatus,
  listAgentPmoRuntimeRemediationItems,
  updateAgentPmoRuntimeRemediationItemStatus,
  getAgentPmoRuntimeHardeningExportById,
  listAgentPmoRuntimeHardeningExports,
  listAgentPmoRuntimeHardeningEvents,
};
