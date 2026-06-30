// ─── PMO Beta Onboarding / Demo Data / Tenant Readiness — Validation ─────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, activate policies, rollback policies, or complete handoffs.
// All demo data must use fictional names — never real customer identifiers.

import type {
  BetaReadinessPlanScope,
  BetaReadinessBlockerType,
  BetaReadinessBlockerSeverity,
  BetaReadinessRemediationItemType,
  DemoDataBundleType,
  DemoProjectScenarioType,
  DemoGovernanceScenarioType,
  DemoHandoffScenarioType,
  BetaOnboardingChecklistItemType,
  BetaUserRole,
} from "./agent-pmo-beta-readiness-types";

// ─── Valid Values ─────────────────────────────────────────────────────────────

export const ALL_BETA_READINESS_SCOPES: BetaReadinessPlanScope[] = [
  "internal_demo",
  "controlled_beta",
  "partner_beta",
  "sales_demo",
  "pmo_demo",
  "full_beta_readiness",
];

export const ALL_BLOCKER_TYPES: BetaReadinessBlockerType[] = [
  "missing_demo_data",
  "unsafe_demo_data",
  "production_data_detected",
  "missing_onboarding_checklist",
  "missing_admin_readiness",
  "missing_docs",
  "missing_export_safety",
  "workspace_isolation_gap",
  "rls_gap",
  "external_communication_risk",
  "external_api_risk",
  "adapter_execution_risk",
  "policy_activation_risk",
  "handoff_mutation_risk",
  "failing_typecheck",
  "failing_test",
  "failing_build",
  "unresolved_known_limitation",
  "unknown",
];

export const ALL_BLOCKER_SEVERITIES: BetaReadinessBlockerSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const ALL_REMEDIATION_TYPES: BetaReadinessRemediationItemType[] = [
  "demo_data_fix",
  "docs_fix",
  "checklist_fix",
  "export_safety_fix",
  "rls_fix",
  "workspace_scope_fix",
  "ui_fix",
  "test_fix",
  "build_fix",
  "known_limitation_documentation",
  "support_process_fix",
  "future_sprint_item",
];

export const ALL_DEMO_BUNDLE_TYPES: DemoDataBundleType[] = [
  "governance_demo",
  "project_handoff_demo",
  "activation_demo",
  "dry_run_demo",
  "pmo_dashboard_demo",
  "full_beta_demo",
];

export const ALL_DEMO_PROJECT_SCENARIO_TYPES: DemoProjectScenarioType[] = [
  "implementation_project",
  "migration_project",
  "security_project",
  "compliance_project",
  "troubled_project",
  "handoff_project",
  "executive_dashboard_project",
];

export const ALL_DEMO_GOVERNANCE_SCENARIO_TYPES: DemoGovernanceScenarioType[] = [
  "policy_change_request",
  "approval_pack",
  "implementation_planning",
  "dry_run_gate",
  "activation_rollback",
  "runtime_hardening",
  "full_governance_path",
];

export const ALL_DEMO_HANDOFF_SCENARIO_TYPES: DemoHandoffScenarioType[] = [
  "workload_rebalance",
  "vacation_coverage",
  "pm_departure",
  "client_escalation",
  "troubled_project_reassignment",
  "senior_pm_takeover",
];

export const ALL_CHECKLIST_ITEM_TYPES: BetaOnboardingChecklistItemType[] = [
  "workspace_created",
  "demo_data_loaded",
  "sample_projects_ready",
  "sample_governance_ready",
  "dashboard_ready",
  "exports_ready",
  "docs_ready",
  "admin_ready",
  "beta_users_defined",
  "invitation_records_ready",
  "safety_checks_passed",
  "known_limitations_reviewed",
  "support_path_defined",
];

export const ALL_BETA_USER_ROLES: BetaUserRole[] = [
  "beta_admin",
  "pmo_director",
  "project_manager",
  "executive_viewer",
  "delivery_lead",
  "demo_viewer",
  "support_admin",
];

// ─── Export Safety Blocked Field Patterns ─────────────────────────────────────

export const BETA_EXPORT_BLOCKED_FIELD_PATTERNS = [
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "private_key",
  "credential",
  "client_secret",
  "refresh_token",
  "access_token",
  "session_cookie",
  "cookie",
  "raw_payload",
  "payload",
  "outcomePayload",
  "safeOutcomePayload",
  "failureMessage",
  "correctionReason",
  "stack_trace",
  "raw_ci_log",
  "real_customer",
  "production_customer",
  "production_data",
  "real_email",
  "real_phone",
  "private_address",
  "personal_identifier",
];

// ─── Forbidden Semantics ──────────────────────────────────────────────────────

export const FORBIDDEN_SEMANTICS = [
  "sendEmail",
  "sendSlack",
  "createJiraTicket",
  "createGithubIssue",
  "createCalendarEvent",
  "scheduleChangeWindow",
  "dispatchExecutionToAdapter",
  "executeAdapter",
  "runAdapter",
  "activatePolicy",
  "rollbackPolicy",
  "executeRollback",
  "completeProjectHandoff",
  "callExternalApi",
  "callOpenAI",
  "callAnthropic",
  "callGemini",
  "createEmbedding",
  "trainModel",
  "fineTuneModel",
  "createProductionTenant",
  "createProductionCustomer",
  "sendInvitation",
  "sendBetaInvite",
];

// ─── Export Safety Validation ─────────────────────────────────────────────────

export function validateBetaExportSafety(content: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const lower = content.toLowerCase();
  for (const pattern of BETA_EXPORT_BLOCKED_FIELD_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      violations.push(`Blocked field pattern detected: ${pattern}`);
    }
  }
  return { safe: violations.length === 0, violations };
}

// ─── Plan Input Validation ────────────────────────────────────────────────────

export type BetaReadinessPlanCreateInput = {
  workspaceId: string;
  scope: BetaReadinessPlanScope;
  title?: string | null;
  description?: string | null;
  triggeredBy?: string | null;
};

export function validateBetaReadinessPlanCreateInput(input: unknown): BetaReadinessPlanCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") throw new Error("workspaceId is required");
  if (!obj.scope || !ALL_BETA_READINESS_SCOPES.includes(obj.scope as BetaReadinessPlanScope)) {
    throw new Error(`scope must be one of: ${ALL_BETA_READINESS_SCOPES.join(", ")}`);
  }
  return {
    workspaceId: obj.workspaceId,
    scope: obj.scope as BetaReadinessPlanScope,
    title: typeof obj.title === "string" ? obj.title : null,
    description: typeof obj.description === "string" ? obj.description : null,
    triggeredBy: typeof obj.triggeredBy === "string" ? obj.triggeredBy : null,
  };
}

// ─── Demo Bundle Input Validation ─────────────────────────────────────────────

export type DemoDataBundleCreateInput = {
  workspaceId: string;
  planId: string;
  bundleType: DemoDataBundleType;
};

export function validateDemoDataBundleCreateInput(input: unknown): DemoDataBundleCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") throw new Error("workspaceId required");
  if (!obj.planId || typeof obj.planId !== "string") throw new Error("planId required");
  if (!obj.bundleType || !ALL_DEMO_BUNDLE_TYPES.includes(obj.bundleType as DemoDataBundleType)) {
    throw new Error(`bundleType must be one of: ${ALL_DEMO_BUNDLE_TYPES.join(", ")}`);
  }
  return {
    workspaceId: obj.workspaceId,
    planId: obj.planId,
    bundleType: obj.bundleType as DemoDataBundleType,
  };
}

// ─── Blocker Input Validation ─────────────────────────────────────────────────

export type BetaReadinessBlockerCreateInput = {
  workspaceId: string;
  planId: string;
  blockerType: BetaReadinessBlockerType;
  severity: BetaReadinessBlockerSeverity;
  title: string;
  description: string;
};

export function validateBetaReadinessBlockerCreateInput(input: unknown): BetaReadinessBlockerCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") throw new Error("workspaceId required");
  if (!obj.planId || typeof obj.planId !== "string") throw new Error("planId required");
  if (!obj.blockerType || !ALL_BLOCKER_TYPES.includes(obj.blockerType as BetaReadinessBlockerType)) {
    throw new Error(`blockerType must be one of: ${ALL_BLOCKER_TYPES.join(", ")}`);
  }
  if (!obj.severity || !ALL_BLOCKER_SEVERITIES.includes(obj.severity as BetaReadinessBlockerSeverity)) {
    throw new Error(`severity must be one of: ${ALL_BLOCKER_SEVERITIES.join(", ")}`);
  }
  if (!obj.title || typeof obj.title !== "string") throw new Error("title required");
  if (!obj.description || typeof obj.description !== "string") throw new Error("description required");
  return {
    workspaceId: obj.workspaceId,
    planId: obj.planId,
    blockerType: obj.blockerType as BetaReadinessBlockerType,
    severity: obj.severity as BetaReadinessBlockerSeverity,
    title: obj.title,
    description: obj.description,
  };
}

// ─── Remediation Input Validation ─────────────────────────────────────────────

export type BetaReadinessRemediationCreateInput = {
  workspaceId: string;
  planId: string;
  blockerId?: string | null;
  remediationType: BetaReadinessRemediationItemType;
  title: string;
  description: string;
};

export function validateBetaReadinessRemediationCreateInput(input: unknown): BetaReadinessRemediationCreateInput {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const obj = input as Record<string, unknown>;
  if (!obj.workspaceId || typeof obj.workspaceId !== "string") throw new Error("workspaceId required");
  if (!obj.planId || typeof obj.planId !== "string") throw new Error("planId required");
  if (!obj.remediationType || !ALL_REMEDIATION_TYPES.includes(obj.remediationType as BetaReadinessRemediationItemType)) {
    throw new Error(`remediationType must be one of: ${ALL_REMEDIATION_TYPES.join(", ")}`);
  }
  if (!obj.title || typeof obj.title !== "string") throw new Error("title required");
  if (!obj.description || typeof obj.description !== "string") throw new Error("description required");
  return {
    workspaceId: obj.workspaceId,
    planId: obj.planId,
    blockerId: typeof obj.blockerId === "string" ? obj.blockerId : null,
    remediationType: obj.remediationType as BetaReadinessRemediationItemType,
    title: obj.title,
    description: obj.description,
  };
}
