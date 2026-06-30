// ─── PMO End-to-End Governance Runtime Hardening — Types ─────────────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// Does NOT create beta tenants, demo customers, or mutate external systems.
// Does NOT create Jira tickets, GitHub issues, calendar events, or embeddings.
// Records ONLY hardening audit records after explicit invocation.

// ─── Hardening Run ────────────────────────────────────────────────────────────

export type AgentPmoRuntimeHardeningRunStatus =
  | "created"
  | "running"
  | "passed"
  | "passed_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type AgentPmoRuntimeHardeningScope =
  | "full_governance_runtime"
  | "route_contracts"
  | "database_contracts"
  | "rls_policies"
  | "workspace_isolation"
  | "observability"
  | "exports"
  | "idempotency"
  | "error_handling"
  | "ui_dashboard"
  | "ci_smoke"
  | "production_readiness";

export type AgentPmoGovernanceLayer =
  | "execution_request_runtime"
  | "tool_adapter_layer"
  | "execution_results_evidence"
  | "human_review_action_inbox"
  | "action_conversion_approval_bridge"
  | "dispatch_gate"
  | "result_reconciliation"
  | "learning_signals"
  | "governance_dashboard"
  | "policy_backlog"
  | "approval_pack"
  | "implementation_planning"
  | "dry_run_gate"
  | "policy_activation_rollback"
  | "project_intelligence_handoff";

export type AgentPmoHardeningBlockerType =
  | "missing_layer_export"
  | "missing_route_contract"
  | "failing_typecheck"
  | "failing_test"
  | "failing_build"
  | "rls_gap"
  | "workspace_isolation_gap"
  | "observability_gap"
  | "export_safety_gap"
  | "unsafe_error_handling"
  | "idempotency_gap"
  | "ui_action_safety_gap"
  | "prohibited_behavior_detected"
  | "terminology_violation"
  | "unresolved_known_limitation"
  | "unknown";

export type AgentPmoHardeningBlockerSeverity = "low" | "medium" | "high" | "critical";

export type AgentPmoHardeningBlockerStatus =
  | "open"
  | "resolved"
  | "accepted"
  | "waived"
  | "blocked"
  | "archived";

export type AgentPmoProductionReadinessGateStatus =
  | "created"
  | "under_review"
  | "passed"
  | "passed_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type AgentPmoProductionReadinessDecisionType =
  | "pass_for_beta_onboarding"
  | "pass_with_warnings"
  | "fail"
  | "block"
  | "request_remediation"
  | "archive";

export type AgentPmoRemediationItemType =
  | "code_fix"
  | "test_fix"
  | "docs_fix"
  | "migration_fix"
  | "route_fix"
  | "export_safety_fix"
  | "rls_policy_fix"
  | "observability_fix"
  | "ui_safety_fix"
  | "known_limitation_documentation"
  | "future_sprint_item";

export type AgentPmoRemediationItemStatus =
  | "created"
  | "in_progress"
  | "completed"
  | "rejected"
  | "blocked"
  | "archived";

export type AgentPmoRuntimeHardeningEventType =
  | "pmo_runtime_hardening_run_created"
  | "pmo_runtime_hardening_run_started"
  | "pmo_runtime_hardening_run_completed"
  | "pmo_layer_integration_audit_recorded"
  | "pmo_route_contract_audit_recorded"
  | "pmo_database_contract_audit_recorded"
  | "pmo_rls_policy_audit_recorded"
  | "pmo_workspace_isolation_check_recorded"
  | "pmo_observability_coverage_check_recorded"
  | "pmo_export_safety_check_recorded"
  | "pmo_idempotency_check_recorded"
  | "pmo_error_handling_check_recorded"
  | "pmo_ui_dashboard_integration_check_recorded"
  | "pmo_ci_smoke_check_recorded"
  | "pmo_production_readiness_gate_created"
  | "pmo_production_readiness_decision_recorded"
  | "pmo_runtime_hardening_blocker_recorded"
  | "pmo_runtime_remediation_item_recorded"
  | "pmo_runtime_hardening_export_created"
  | "pmo_runtime_hardening_run_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoRuntimeHardeningRunRecord = {
  id: string;
  workspaceId: string;
  scope: AgentPmoRuntimeHardeningScope;
  status: AgentPmoRuntimeHardeningRunStatus;
  triggeredBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  layersAudited: AgentPmoGovernanceLayer[];
  blockerCount: number;
  warningCount: number;
  passedCheckCount: number;
  failedCheckCount: number;
  safeRunPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoLayerIntegrationAuditRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  layer: AgentPmoGovernanceLayer;
  typeFileExists: boolean;
  validationFileExists: boolean | null;
  registryFileExists: boolean | null;
  serviceFileExists: boolean | null;
  docsExist: boolean;
  testsExist: boolean;
  migrationExists: boolean | null;
  apiRoutesExist: boolean | null;
  exportsExist: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeAuditPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoRouteContractAuditRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  routePath: string;
  routeExists: boolean;
  exportedMethods: string[];
  dynamicParamsFollowConvention: boolean;
  requestParsingIsSafe: boolean;
  responsesAreDeterministic: boolean;
  errorsAreSanitized: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeAuditPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoDatabaseContractAuditRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  tableName: string;
  migrationExists: boolean;
  rowTypeExists: boolean;
  columnConstantsExist: boolean;
  contractVersionIncludes: boolean;
  indexesExist: boolean;
  createdAtConvention: boolean;
  updatedAtConvention: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeAuditPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoRlsPolicyAuditRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  tableName: string;
  rlsEnabled: boolean;
  workspaceScopedReadExists: boolean;
  writePolicesExist: boolean;
  noPublicAccess: boolean;
  noBroadUsingTrue: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeAuditPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoWorkspaceIsolationCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  checkTarget: string;
  workspaceIdRequired: boolean;
  listFunctionsFilterByWorkspace: boolean;
  getFunctionsVerifyWorkspace: boolean;
  apiRoutesRequireWorkspaceId: boolean;
  noCrossWorkspaceLeakage: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoObservabilityCoverageCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  sourceTypesExist: boolean;
  eventTypesExist: boolean;
  categoryIsGovernance: boolean;
  noCircularImports: boolean;
  noUnsafePayload: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoExportSafetyCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  exportTarget: string;
  rawPayloadsExcluded: boolean;
  secretsExcluded: boolean;
  tokensExcluded: boolean;
  credentialsExcluded: boolean;
  stackTracesExcluded: boolean;
  unnecessaryPersonalDataExcluded: boolean;
  nonGoalsIncluded: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoIdempotencyCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  checkTarget: string;
  appendOnlyDecisionsPreserved: boolean;
  pointerUpdatesPreservePrevious: boolean;
  completionRequiresCorrectStatus: boolean;
  activationRequiresApprovedGate: boolean;
  rollbackRequiresApprovedGate: boolean;
  exportsRegeneratable: boolean;
  archiveDoesNotHardDelete: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoErrorHandlingCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  checkTarget: string;
  routeErrorsSanitized: boolean;
  serviceErrorsDoNotLeakPayloads: boolean;
  validationErrorsAreClear: boolean;
  missingRecordsReturnSafeMessages: boolean;
  stackTracesNotReturnedFromApi: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoUiDashboardIntegrationCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  dashboardRoutesExist: boolean;
  commandCenterPageBuilds: boolean;
  noUncontrolledActionButtons: boolean;
  noProhibitedLabels: boolean;
  passed: boolean;
  warnings: string[];
  findings: string[];
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoCiSmokeCheckRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  typecheckResult: "passed" | "failed" | "unknown";
  testResult: "passed" | "failed" | "unknown";
  buildResult: "passed" | "failed" | "unknown";
  hardeningTestResult: "passed" | "failed" | "unknown";
  terminologyResult: "clean" | "violations_found" | "unknown";
  prohibitedBehaviorResult: "clean" | "violations_found" | "unknown";
  safeSmokeSummary: string;
  passed: boolean;
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoProductionReadinessGateRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  status: AgentPmoProductionReadinessGateStatus;
  openBlockerCount: number;
  criticalBlockerCount: number;
  safeGatePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProductionReadinessDecisionRecord = {
  id: string;
  workspaceId: string;
  gateId: string;
  decisionType: AgentPmoProductionReadinessDecisionType;
  rationale: string;
  decidedById: string | null;
  safeDecisionPayloadJson: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoRuntimeHardeningBlockerRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  blockerType: AgentPmoHardeningBlockerType;
  severity: AgentPmoHardeningBlockerSeverity;
  status: AgentPmoHardeningBlockerStatus;
  title: string;
  description: string;
  affectedLayer: AgentPmoGovernanceLayer | null;
  affectedFile: string | null;
  resolvedAt: string | null;
  safeBlockerPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoRuntimeRemediationItemRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  blockerId: string | null;
  remediationType: AgentPmoRemediationItemType;
  status: AgentPmoRemediationItemStatus;
  title: string;
  description: string;
  safeRemediationPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoRuntimeHardeningExportRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string;
  exportFormat: "markdown" | "json" | "csv";
  exportStatus: "created" | "ready" | "failed";
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdById: string | null;
  createdAt: string;
};

export type AgentPmoRuntimeHardeningEventRecord = {
  id: string;
  workspaceId: string;
  hardeningRunId: string | null;
  eventType: AgentPmoRuntimeHardeningEventType;
  message: string | null;
  safeEventPayloadJson: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

// ─── Summary ──────────────────────────────────────────────────────────────────

export type AgentPmoRuntimeHardeningSummary = {
  hardeningRunId: string;
  workspaceId: string;
  scope: AgentPmoRuntimeHardeningScope;
  status: AgentPmoRuntimeHardeningRunStatus;
  layersAudited: AgentPmoGovernanceLayer[];
  blockerCount: number;
  warningCount: number;
  passedCheckCount: number;
  failedCheckCount: number;
  productionReadinessGateStatus: AgentPmoProductionReadinessGateStatus | null;
  openCriticalBlockers: number;
  generatedAt: string;
  nonGoals: string[];
};
