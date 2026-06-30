// ─── PMO Beta Onboarding / Demo Data / Tenant Readiness — Types ──────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// Does NOT create production tenants, production customers, or mutate external systems.
// Does NOT create Jira tickets, GitHub issues, calendar events, or embeddings.
// Records ONLY beta readiness planning records after explicit invocation.
// All demo data uses fictional names only — no real customer names or identifiers.

// ─── Beta Readiness Plan ──────────────────────────────────────────────────────

export type BetaReadinessPlanStatus =
  | "created"
  | "preparing"
  | "ready_for_review"
  | "ready_for_beta"
  | "ready_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type BetaReadinessPlanScope =
  | "internal_demo"
  | "controlled_beta"
  | "partner_beta"
  | "sales_demo"
  | "pmo_demo"
  | "full_beta_readiness";

export type BetaReadinessPlanRecord = {
  id: string;
  workspaceId: string;
  scope: BetaReadinessPlanScope;
  status: BetaReadinessPlanStatus;
  title: string;
  description: string | null;
  triggeredBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockerCount: number;
  warningCount: number;
  safePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Workspace Readiness ─────────────────────────────────────────────────

export type BetaWorkspaceReadinessStatus =
  | "created"
  | "checklist_pending"
  | "data_pending"
  | "validation_pending"
  | "ready"
  | "ready_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type BetaWorkspaceReadinessRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: BetaWorkspaceReadinessStatus;
  checklistPassed: boolean;
  demoPassed: boolean;
  validationPassed: boolean;
  safeCheckPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Demo Data Bundle ─────────────────────────────────────────────────────────

export type DemoDataBundleStatus =
  | "created"
  | "generated"
  | "validated"
  | "ready"
  | "failed"
  | "blocked"
  | "archived";

export type DemoDataBundleType =
  | "governance_demo"
  | "project_handoff_demo"
  | "activation_demo"
  | "dry_run_demo"
  | "pmo_dashboard_demo"
  | "full_beta_demo";

export type DemoDataBundleRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  bundleType: DemoDataBundleType;
  status: DemoDataBundleStatus;
  projectScenarioCount: number;
  governanceScenarioCount: number;
  handoffScenarioCount: number;
  safePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Demo Project Scenario ────────────────────────────────────────────────────

export type DemoProjectScenarioStatus =
  | "created"
  | "generated"
  | "validated"
  | "ready"
  | "failed"
  | "blocked"
  | "archived";

export type DemoProjectScenarioType =
  | "implementation_project"
  | "migration_project"
  | "security_project"
  | "compliance_project"
  | "troubled_project"
  | "handoff_project"
  | "executive_dashboard_project";

export type DemoProjectScenarioRecord = {
  id: string;
  workspaceId: string;
  bundleId: string;
  scenarioType: DemoProjectScenarioType;
  status: DemoProjectScenarioStatus;
  fictionalProjectName: string;
  fictionalPmName: string;
  fictionalClientName: string;
  safeScenarioPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Demo Governance Scenario ─────────────────────────────────────────────────

export type DemoGovernanceScenarioStatus =
  | "created"
  | "generated"
  | "validated"
  | "ready"
  | "failed"
  | "blocked"
  | "archived";

export type DemoGovernanceScenarioType =
  | "policy_change_request"
  | "approval_pack"
  | "implementation_planning"
  | "dry_run_gate"
  | "activation_rollback"
  | "runtime_hardening"
  | "full_governance_path";

export type DemoGovernanceScenarioRecord = {
  id: string;
  workspaceId: string;
  bundleId: string;
  scenarioType: DemoGovernanceScenarioType;
  status: DemoGovernanceScenarioStatus;
  fictionalPolicyTitle: string;
  fictionalRequestorName: string;
  safeScenarioPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Demo Handoff Scenario ────────────────────────────────────────────────────

export type DemoHandoffScenarioStatus =
  | "created"
  | "generated"
  | "validated"
  | "ready"
  | "failed"
  | "blocked"
  | "archived";

export type DemoHandoffScenarioType =
  | "workload_rebalance"
  | "vacation_coverage"
  | "pm_departure"
  | "client_escalation"
  | "troubled_project_reassignment"
  | "senior_pm_takeover";

export type DemoHandoffScenarioRecord = {
  id: string;
  workspaceId: string;
  bundleId: string;
  scenarioType: DemoHandoffScenarioType;
  status: DemoHandoffScenarioStatus;
  fictionalFromPmName: string;
  fictionalToPmName: string;
  fictionalProjectName: string;
  safeScenarioPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Onboarding Checklist ────────────────────────────────────────────────

export type BetaOnboardingChecklistStatus =
  | "created"
  | "in_progress"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type BetaOnboardingChecklistItemType =
  | "workspace_created"
  | "demo_data_loaded"
  | "sample_projects_ready"
  | "sample_governance_ready"
  | "dashboard_ready"
  | "exports_ready"
  | "docs_ready"
  | "admin_ready"
  | "beta_users_defined"
  | "invitation_records_ready"
  | "safety_checks_passed"
  | "known_limitations_reviewed"
  | "support_path_defined";

export type BetaOnboardingChecklistRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: BetaOnboardingChecklistStatus;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  waivedItems: number;
  safePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Onboarding Checklist Item ──────────────────────────────────────────

export type BetaOnboardingChecklistItemStatus =
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "waived"
  | "not_applicable";

export type BetaOnboardingChecklistItemRecord = {
  id: string;
  workspaceId: string;
  checklistId: string;
  itemType: BetaOnboardingChecklistItemType;
  status: BetaOnboardingChecklistItemStatus;
  title: string;
  notes: string | null;
  waivedReason: string | null;
  checkedAt: string | null;
  safeItemPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta User Readiness ──────────────────────────────────────────────────────

export type BetaUserReadinessStatus =
  | "created"
  | "pending_review"
  | "ready"
  | "ready_with_limitations"
  | "blocked"
  | "archived";

export type BetaUserRole =
  | "beta_admin"
  | "pmo_director"
  | "project_manager"
  | "executive_viewer"
  | "delivery_lead"
  | "demo_viewer"
  | "support_admin";

export type BetaUserReadinessRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: BetaUserReadinessStatus;
  role: BetaUserRole;
  fictionalUserLabel: string;
  knownLimitations: string[];
  safePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Invitation Readiness ────────────────────────────────────────────────

export type BetaInvitationReadinessStatus =
  | "created"
  | "prepared"
  | "reviewed"
  | "ready_to_send_manually"
  | "blocked"
  | "archived";

export type BetaInvitationReadinessRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: BetaInvitationReadinessStatus;
  invitationCount: number;
  safeInvitationTemplateJson: Record<string, unknown>;
  reviewedAt: string | null;
  safePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Admin Readiness ─────────────────────────────────────────────────────

export type BetaAdminReadinessStatus =
  | "created"
  | "in_progress"
  | "ready"
  | "ready_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type BetaAdminReadinessRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: BetaAdminReadinessStatus;
  workspaceIsolationVerified: boolean;
  rlsVerified: boolean;
  exportSafetyVerified: boolean;
  docsReviewed: boolean;
  supportPathDefined: boolean;
  safePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Tenant Readiness Validation ──────────────────────────────────────────────

export type TenantReadinessValidationStatus =
  | "pending"
  | "passed"
  | "passed_with_warnings"
  | "failed"
  | "blocked"
  | "waived";

export type TenantReadinessValidationRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: TenantReadinessValidationStatus;
  checkName: string;
  passed: boolean;
  warnings: string[];
  findings: string[];
  waivedReason: string | null;
  safeValidationPayloadJson: Record<string, unknown>;
  createdAt: string;
};

// ─── Beta Readiness Gate ──────────────────────────────────────────────────────

export type BetaReadinessGateStatus =
  | "created"
  | "under_review"
  | "passed"
  | "passed_with_warnings"
  | "failed"
  | "blocked"
  | "archived";

export type BetaReadinessDecisionType =
  | "approve_for_controlled_beta"
  | "approve_with_warnings"
  | "reject"
  | "request_remediation"
  | "block"
  | "archive";

export type BetaReadinessGateRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  status: BetaReadinessGateStatus;
  openBlockerCount: number;
  criticalBlockerCount: number;
  safeGatePayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Readiness Decision ──────────────────────────────────────────────────

export type BetaReadinessDecisionRecord = {
  id: string;
  workspaceId: string;
  gateId: string;
  decisionType: BetaReadinessDecisionType;
  rationale: string;
  decidedById: string | null;
  safeDecisionPayloadJson: Record<string, unknown>;
  createdAt: string;
};

// ─── Beta Readiness Blocker ───────────────────────────────────────────────────

export type BetaReadinessBlockerType =
  | "missing_demo_data"
  | "unsafe_demo_data"
  | "production_data_detected"
  | "missing_onboarding_checklist"
  | "missing_admin_readiness"
  | "missing_docs"
  | "missing_export_safety"
  | "workspace_isolation_gap"
  | "rls_gap"
  | "external_communication_risk"
  | "external_api_risk"
  | "adapter_execution_risk"
  | "policy_activation_risk"
  | "handoff_mutation_risk"
  | "failing_typecheck"
  | "failing_test"
  | "failing_build"
  | "unresolved_known_limitation"
  | "unknown";

export type BetaReadinessBlockerSeverity = "low" | "medium" | "high" | "critical";

export type BetaReadinessBlockerStatus =
  | "open"
  | "resolved"
  | "accepted"
  | "waived"
  | "blocked"
  | "archived";

export type BetaReadinessBlockerRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  blockerType: BetaReadinessBlockerType;
  severity: BetaReadinessBlockerSeverity;
  status: BetaReadinessBlockerStatus;
  title: string;
  description: string;
  resolvedAt: string | null;
  safeBlockerPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Readiness Remediation Item ─────────────────────────────────────────

export type BetaReadinessRemediationItemType =
  | "demo_data_fix"
  | "docs_fix"
  | "checklist_fix"
  | "export_safety_fix"
  | "rls_fix"
  | "workspace_scope_fix"
  | "ui_fix"
  | "test_fix"
  | "build_fix"
  | "known_limitation_documentation"
  | "support_process_fix"
  | "future_sprint_item";

export type BetaReadinessRemediationItemStatus =
  | "created"
  | "in_progress"
  | "completed"
  | "rejected"
  | "blocked"
  | "archived";

export type BetaReadinessRemediationItemRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  blockerId: string | null;
  remediationType: BetaReadinessRemediationItemType;
  status: BetaReadinessRemediationItemStatus;
  title: string;
  description: string;
  safeRemediationPayloadJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// ─── Beta Readiness Export ────────────────────────────────────────────────────

export type BetaReadinessExportRecord = {
  id: string;
  workspaceId: string;
  planId: string;
  exportFormat: "markdown" | "json" | "csv";
  exportStatus: "created" | "ready" | "failed";
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdById: string | null;
  createdAt: string;
};

// ─── Beta Readiness Event ─────────────────────────────────────────────────────

export type BetaReadinessEventType =
  | "beta_readiness_plan_created"
  | "beta_workspace_readiness_recorded"
  | "demo_data_bundle_created"
  | "demo_data_bundle_validated"
  | "demo_project_scenario_created"
  | "demo_governance_scenario_created"
  | "demo_handoff_scenario_created"
  | "beta_onboarding_checklist_created"
  | "beta_onboarding_checklist_item_recorded"
  | "beta_user_readiness_recorded"
  | "beta_invitation_readiness_recorded"
  | "beta_admin_readiness_recorded"
  | "tenant_readiness_validation_recorded"
  | "beta_readiness_gate_created"
  | "beta_readiness_decision_recorded"
  | "beta_readiness_blocker_recorded"
  | "beta_readiness_remediation_recorded"
  | "beta_readiness_export_created"
  | "beta_readiness_plan_archived";

export type BetaReadinessEventRecord = {
  id: string;
  workspaceId: string;
  planId: string | null;
  eventType: BetaReadinessEventType;
  message: string | null;
  safeEventPayloadJson: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

// ─── Summary ──────────────────────────────────────────────────────────────────

export type BetaReadinessSummary = {
  planId: string;
  workspaceId: string;
  scope: BetaReadinessPlanScope;
  status: BetaReadinessPlanStatus;
  blockerCount: number;
  warningCount: number;
  gateStatus: BetaReadinessGateStatus | null;
  openCriticalBlockers: number;
  generatedAt: string;
  nonGoals: string[];
};
