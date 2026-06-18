/**
 * Canonical database contract for PMFreak.
 *
 * This file is the single source of truth for every column the runtime
 * is permitted to read or write.  Any column referenced in application
 * code MUST be declared here.  The companion script
 * scripts/check-db-schema-contract.mjs enforces this at build time by
 * cross-checking declarations against actual migration files.
 *
 * DO NOT add columns here without a corresponding migration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// workspaces
// Source: 20260512160000_workspace_authorization_rewrite.sql
//         20260601000000_schema_contract_hardening.sql (status column)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceStatus = "active" | "archived" | "deleted";

export type WorkspaceRow = {
  id: string;              // uuid
  name: string;            // text not null default 'Workspace'
  created_by_user_id: string | null; // uuid references auth.users
  status: WorkspaceStatus; // text not null default 'active' (added 20260601)
  created_at: string;      // timestamptz
};

export const WORKSPACE_SELECTABLE_COLUMNS = [
  "id",
  "name",
  "created_by_user_id",
  "status",
  "created_at",
] as const satisfies ReadonlyArray<keyof WorkspaceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// workspace_memberships
// Source: 20260512160000_workspace_authorization_rewrite.sql
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceMemberRole = "owner" | "admin" | "pm" | "viewer";

export type WorkspaceMembershipRow = {
  workspace_id: string;    // uuid (PK part 1)
  user_id: string;         // uuid (PK part 2)
  role: WorkspaceMemberRole;
  created_at: string;      // timestamptz
};

export const WORKSPACE_MEMBERSHIP_SELECTABLE_COLUMNS = [
  "workspace_id",
  "user_id",
  "role",
  "created_at",
] as const satisfies ReadonlyArray<keyof WorkspaceMembershipRow>;

// ─────────────────────────────────────────────────────────────────────────────
// projects
// Source: 20260504100000_projects_system.sql
//         20260512160000_workspace_authorization_rewrite.sql (workspace_id)
//         20260601000000_schema_contract_hardening.sql (onboarding_payload)
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectStatus = "active" | "archived" | "completed";

export type ProjectRow = {
  id: string;                  // uuid
  user_id: string;             // uuid references auth.users
  workspace_id: string;        // uuid references workspaces (not null after migration)
  name: string;                // text not null
  description: string | null;  // text
  status: ProjectStatus;       // text not null default 'active'
  onboarding_payload: Record<string, unknown> | null; // jsonb (added 20260601)
  created_at: string;          // timestamptz
  updated_at: string;          // timestamptz
};

export const PROJECT_SELECTABLE_COLUMNS = [
  "id",
  "user_id",
  "workspace_id",
  "name",
  "description",
  "status",
  "onboarding_payload",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ProjectRow>;

// ─────────────────────────────────────────────────────────────────────────────
// workspace_governance
// Source: 20260527091000_workspace_governance.sql
//
// workspace_id is stored as text (matches uuid values from workspaces.id).
// RLS policy casts workspace_id::uuid for membership join.
//
// schema_version semantics (intentional two-phase design):
//   1 = PMOGovernanceSkeleton (governance wizard output)
//   2 = PmoTenant (full PMO tenant activation; loadPmoTenant requires this)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceGovernanceStatus = "active" | "archived";

export type WorkspaceGovernanceRow = {
  workspace_id: string;              // text (contains uuid value; PK)
  schema_version: number;            // integer: 1 = skeleton, 2 = tenant
  governance_jsonb: Record<string, unknown>; // jsonb
  status: WorkspaceGovernanceStatus; // text not null default 'active'
  created_at: string;                // timestamptz
  updated_at: string;                // timestamptz
};

export const GOVERNANCE_SCHEMA_VERSION_SKELETON = 1 as const;
export const GOVERNANCE_SCHEMA_VERSION_TENANT   = 2 as const;

export const WORKSPACE_GOVERNANCE_SELECTABLE_COLUMNS = [
  "workspace_id",
  "schema_version",
  "governance_jsonb",
  "status",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof WorkspaceGovernanceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// workspace_runtime_state
// Source: 20260527090000_workspace_runtime_state.sql
//
// company_id / workspace_id / user_id are ALL text by design: they carry
// values from external authority contexts that are not always Supabase UUIDs.
// RLS enforces auth.uid()::text = user_id.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceRuntimeStateRow = {
  company_id: string;             // text (PK part 1)
  workspace_id: string;           // text (PK part 2) — NOT a FK to workspaces
  user_id: string;                // text (PK part 3) — RLS: auth.uid()::text
  awakening_state: Record<string, unknown>;
  imprint_state: Record<string, unknown>;
  validation_state: Record<string, unknown>;
  flags: Record<string, unknown>;
  updated_at: string;             // timestamptz
};

export const WORKSPACE_RUNTIME_STATE_SELECTABLE_COLUMNS = [
  "company_id",
  "workspace_id",
  "user_id",
  "awakening_state",
  "imprint_state",
  "validation_state",
  "flags",
  "updated_at",
] as const satisfies ReadonlyArray<keyof WorkspaceRuntimeStateRow>;


// ─────────────────────────────────────────────────────────────────────────────
// operational_governance_briefs
// Source: 20260602000000_operational_governance_briefs.sql
// Stores the deterministic First Insight Engine brief generated immediately
// after project creation.
// ─────────────────────────────────────────────────────────────────────────────

export type OperationalGovernanceBriefRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  brief_payload: Record<string, unknown>;
  confidence_score: number;
  generated_at: string;
  created_by: string | null;
};

export const OPERATIONAL_GOVERNANCE_BRIEF_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "brief_payload",
  "confidence_score",
  "generated_at",
  "created_by",
] as const satisfies ReadonlyArray<keyof OperationalGovernanceBriefRow>;



// ─────────────────────────────────────────────────────────────────────────────
// project_discovery
// Source: 20260605020000_project_discovery.sql
// Versioned operational discovery generated from canonical project evidence.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectDiscoveryRow = {
  id: string;
  project_id: string;
  workspace_id: string;
  version: number;
  stakeholders_json: Record<string, unknown>[];
  dependencies_json: Record<string, unknown>[];
  risks_json: Record<string, unknown>[];
  milestones_json: Record<string, unknown>[];
  deliverables_json: Record<string, unknown>[];
  assumptions_json: Record<string, unknown>[];
  unknowns_json: Record<string, unknown>[];
  confidence_score: number;
  discovery_payload_hash: string | null;
  evidence_count: number;
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export const PROJECT_DISCOVERY_SELECTABLE_COLUMNS = [
  "id",
  "project_id",
  "workspace_id",
  "version",
  "stakeholders_json",
  "dependencies_json",
  "risks_json",
  "milestones_json",
  "deliverables_json",
  "assumptions_json",
  "unknowns_json",
  "confidence_score",
  "discovery_payload_hash",
  "evidence_count",
  "generated_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ProjectDiscoveryRow>;

// ─────────────────────────────────────────────────────────────────────────────
// raid_items
// Source: 20260602020000_raid_auto_extraction.sql
// Canonical PMO RAID entities generated from deterministic vault intake.
// ─────────────────────────────────────────────────────────────────────────────

export type RaidItemCategory = "risk" | "assumption" | "issue" | "dependency";
export type RaidItemStatus = "open" | "monitoring" | "mitigated" | "closed";

export type RaidItemRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  source_document_id: string;
  source_signal_id: string | null;
  category: RaidItemCategory;
  title: string;
  description: string;
  status: RaidItemStatus;
  confidence_score: number;
  detected_at: string;
  last_detected_at: string;
  detected_by: string | null;
  owner: string | null;
  due_date: string | null;
  auto_generated: boolean;
  fingerprint: string;
  occurrence_count: number;
};

export const RAID_ITEM_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "source_document_id",
  "source_signal_id",
  "category",
  "title",
  "description",
  "status",
  "confidence_score",
  "detected_at",
  "last_detected_at",
  "detected_by",
  "owner",
  "due_date",
  "auto_generated",
  "fingerprint",
  "occurrence_count",
] as const satisfies ReadonlyArray<keyof RaidItemRow>;

// ─────────────────────────────────────────────────────────────────────────────
// trial_licenses
// Source: 20260512198000_early_access_trials.sql
// ─────────────────────────────────────────────────────────────────────────────

export type TrialStatus = "pending" | "active" | "expired" | "revoked";

export type TrialLicenseRow = {
  id: string;                    // uuid
  invite_id: string;             // uuid unique references early_access_invites
  workspace_id: string | null;   // uuid references workspaces (nullable)
  trial_start_at: string | null; // timestamptz
  trial_end_at: string | null;   // timestamptz
  trial_status: TrialStatus;     // enum
  revoked_at: string | null;     // timestamptz
  created_at: string;            // timestamptz
  updated_at: string;            // timestamptz
};

export const TRIAL_LICENSE_SELECTABLE_COLUMNS = [
  "id",
  "invite_id",
  "workspace_id",
  "trial_start_at",
  "trial_end_at",
  "trial_status",
  "revoked_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof TrialLicenseRow>;

// ─────────────────────────────────────────────────────────────────────────────
// early_access_invites
// Source: 20260512198000_early_access_trials.sql
// ─────────────────────────────────────────────────────────────────────────────

export type EarlyAccessInviteRow = {
  id: string;                       // uuid
  invite_email: string;             // text not null
  invite_token_hash: string;        // text not null unique
  invite_note: string | null;       // text
  inviter_user_id: string;          // uuid references auth.users
  expires_at: string;               // timestamptz
  accepted_at: string | null;       // timestamptz
  revoked_at: string | null;        // timestamptz
  requires_approval: boolean;       // boolean default false
  approved_at: string | null;       // timestamptz
  approved_by_user_id: string | null; // uuid references auth.users
  workspace_id: string | null;      // uuid references workspaces
  created_at: string;               // timestamptz
  updated_at: string;               // timestamptz
};

export const EARLY_ACCESS_INVITE_SELECTABLE_COLUMNS = [
  "id",
  "invite_email",
  "invite_token_hash",
  "invite_note",
  "inviter_user_id",
  "expires_at",
  "accepted_at",
  "revoked_at",
  "requires_approval",
  "approved_at",
  "approved_by_user_id",
  "workspace_id",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof EarlyAccessInviteRow>;

// ─────────────────────────────────────────────────────────────────────────────
// workspace_activations
// Source: 20260512198000_early_access_trials.sql
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceActivationRow = {
  id: string;                              // uuid
  invite_id: string;                       // uuid unique references early_access_invites
  trial_license_id: string;               // uuid unique references trial_licenses
  workspace_id: string;                   // uuid references workspaces
  activated_by_user_id: string;           // uuid references auth.users
  runtime_authority_linkage: Record<string, unknown>; // jsonb
  governance_profile: Record<string, unknown>;        // jsonb
  explainability_defaults: Record<string, unknown>;   // jsonb
  machine_governance_defaults: Record<string, unknown>; // jsonb
  starter_cognition_state: Record<string, unknown>;   // jsonb
  operational_memory_namespace: string;   // text not null
  activated_at: string;                   // timestamptz
  initialization_status: string;          // text default 'succeeded'
  initialization_error: string | null;    // text
  created_at: string;                     // timestamptz
};

// ─────────────────────────────────────────────────────────────────────────────
// onboarding_analyses
// Source: 20260430170000_onboarding_analyses.sql
//         20260512183000_enterprise_auth_integrity.sql (workspace_id)
//         20260504100000_projects_system.sql (project_id)
// ─────────────────────────────────────────────────────────────────────────────

export type OnboardingAnalysisRow = {
  id: string;                   // uuid
  company_id: string;           // text
  user_id: string;              // uuid references auth.users
  workspace_id: string;         // uuid references workspaces
  project_id: string | null;    // uuid references projects (nullable)
  workspace: string;            // text (legacy field, freeform)
  role: string;                 // text
  project_type: string;         // text
  problem: string;              // text
  analysis: string;             // text
  source: string;               // text default 'onboarding'
  created_at: string;           // timestamptz
};

// ─────────────────────────────────────────────────────────────────────────────
// pmo_team_invites
// Source: 20260528000000_pmo_team_invites.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PmoTeamInviteStatus = "pending" | "accepted" | "revoked";

export type PmoTeamInviteRow = {
  id: string;                  // uuid
  workspace_id: string;        // uuid references workspaces
  invited_by_user_id: string;  // uuid
  email: string;               // text
  role: string;                // text
  domain_focus: string[];      // text[]
  status: PmoTeamInviteStatus; // text default 'pending'
  created_at: string;          // timestamptz
  updated_at: string;          // timestamptz
};

// ─────────────────────────────────────────────────────────────────────────────
// recommended_actions
// Source: 20260605040000_recommended_actions.sql
//         20260605050000_recommended_actions_decision_workflow.sql
//         20260611000000_operational_evidence_decision_loop.sql
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendedActionStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "deferred"
  | "converted_to_task"
  | "modified"
  | "executed";

export type RecommendedActionRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  raid_item_id: string | null;
  governance_event_id: string | null;
  risk_issue_id: string | null;
  title: string;
  description: string;
  recommendation: string | null;
  recommended_action_type: string;
  status: RecommendedActionStatus;
  confidence_score: number | null;
  impact_level: string | null;
  rationale: Record<string, unknown> | null;
  recommended_owner: string | null;
  recommended_due_window: string | null;
  urgency: "low" | "medium" | "high" | "immediate" | null;
  suggested_owner_user_id: string | null;
  evidence_summary: Record<string, unknown> | null;
  source_signal_id: string | null;
  fingerprint: string;
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  deferred_until: string | null;
  converted_task_id: string | null;
  decision_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const RECOMMENDED_ACTION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "raid_item_id",
  "governance_event_id",
  "risk_issue_id",
  "title",
  "description",
  "recommendation",
  "recommended_action_type",
  "status",
  "confidence_score",
  "impact_level",
  "rationale",
  "recommended_owner",
  "recommended_due_window",
  "urgency",
  "suggested_owner_user_id",
  "evidence_summary",
  "source_signal_id",
  "fingerprint",
  "decision_reason",
  "decided_by",
  "decided_at",
  "deferred_until",
  "converted_task_id",
  "decision_metadata",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof RecommendedActionRow>;

// ─────────────────────────────────────────────────────────────────────────────
// task_drafts
// Source: 20260605060000_task_drafts.sql
// Traceable Task Draft created when a PM converts a Recommended Action.
// The system drafts. The PM confirms. No automatic task execution.
// ─────────────────────────────────────────────────────────────────────────────

export type TaskDraftStatus =
  | "draft"
  | "reviewed"
  | "approved"
  | "discarded"
  | "converted_to_task";

export type TaskDraftPriority = "low" | "medium" | "high" | "critical";

export type TaskDraftRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  recommended_action_id: string;
  raid_item_id: string | null;
  title: string;
  description: string;
  draft_status: TaskDraftStatus;
  suggested_owner: string | null;
  suggested_due_date: string | null;
  suggested_due_window: string | null;
  priority: TaskDraftPriority;
  source_type: string;
  source_payload: Record<string, unknown>;
  acceptance_criteria: string[];
  checklist: string[];
  confidence_score: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const TASK_DRAFT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "recommended_action_id",
  "raid_item_id",
  "title",
  "description",
  "draft_status",
  "suggested_owner",
  "suggested_due_date",
  "suggested_due_window",
  "priority",
  "source_type",
  "source_payload",
  "acceptance_criteria",
  "checklist",
  "confidence_score",
  "created_by",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof TaskDraftRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_tasks
// Source: 20260605070000_execution_tasks.sql
// Canonical operational work unit. Task Draft → Execution Task.
// Machine drafts. Human approves. System executes governance.
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionTaskStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type ExecutionTaskPriority = "low" | "medium" | "high" | "critical";

export type TaskScheduleStatus =
  | "unscheduled"
  | "scheduled"
  | "at_risk"
  | "delayed"
  | "completed"
  | "cancelled";

export type ExecutionTaskRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  task_draft_id: string;
  recommended_action_id: string | null;
  raid_item_id: string | null;
  title: string;
  description: string;
  status: ExecutionTaskStatus;
  priority: ExecutionTaskPriority;
  owner_user_id: string | null;
  owner_name: string | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  progress_percent: number;
  acceptance_criteria: string[];
  checklist: string[];
  confidence_score: number | null;
  source_payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Schedule fields (added H8)
  planned_start_date: string | null;
  planned_finish_date: string | null;
  baseline_start_date: string | null;
  baseline_finish_date: string | null;
  forecast_start_date: string | null;
  forecast_finish_date: string | null;
  milestone_id: string | null;
  schedule_status: TaskScheduleStatus;
  schedule_confidence: number | null;
  // Critical path fields (added H9)
  is_critical: boolean;
  early_start: number | null;
  early_finish: number | null;
  late_start: number | null;
  late_finish: number | null;
  total_float: number | null;
  free_float: number | null;
  variance_days: number | null;
  criticality_score: number | null;
};

export const EXECUTION_TASK_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "task_draft_id",
  "recommended_action_id",
  "raid_item_id",
  "title",
  "description",
  "status",
  "priority",
  "owner_user_id",
  "owner_name",
  "start_date",
  "due_date",
  "completed_at",
  "progress_percent",
  "acceptance_criteria",
  "checklist",
  "confidence_score",
  "source_payload",
  "created_by",
  "created_at",
  "updated_at",
  "planned_start_date",
  "planned_finish_date",
  "baseline_start_date",
  "baseline_finish_date",
  "forecast_start_date",
  "forecast_finish_date",
  "milestone_id",
  "schedule_status",
  "schedule_confidence",
  "is_critical",
  "early_start",
  "early_finish",
  "late_start",
  "late_finish",
  "total_float",
  "free_float",
  "variance_days",
  "criticality_score",
] as const satisfies ReadonlyArray<keyof ExecutionTaskRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_task_events
// Source: 20260605070000_execution_tasks.sql
// Immutable audit trail for every lifecycle action on an execution task.
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionTaskEventRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  task_id: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
};

export const EXECUTION_TASK_EVENT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "task_id",
  "event_type",
  "event_payload",
  "actor_user_id",
  "created_at",
] as const satisfies ReadonlyArray<keyof ExecutionTaskEventRow>;

// ─────────────────────────────────────────────────────────────────────────────
// project_milestones
// Source: 20260605090000_milestones_schedule_foundation.sql
// Project milestones with planned, baseline, and forecast dates.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectMilestoneType =
  | "kickoff"
  | "discovery"
  | "design"
  | "approval"
  | "delivery"
  | "deployment"
  | "training"
  | "acceptance"
  | "go_live"
  | "handover"
  | "other";

export type ProjectMilestoneStatus =
  | "planned"
  | "at_risk"
  | "blocked"
  | "completed"
  | "cancelled";

export type ProjectMilestoneRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description: string | null;
  milestone_type: ProjectMilestoneType;
  status: ProjectMilestoneStatus;
  target_date: string | null;
  baseline_date: string | null;
  forecast_date: string | null;
  completed_at: string | null;
  confidence_score: number | null;
  source_type: string;
  source_payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const PROJECT_MILESTONE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "title",
  "description",
  "milestone_type",
  "status",
  "target_date",
  "baseline_date",
  "forecast_date",
  "completed_at",
  "confidence_score",
  "source_type",
  "source_payload",
  "created_by",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ProjectMilestoneRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_task_dependencies
// Source: 20260605080000_execution_task_dependencies.sql
// Models dependencies between execution tasks: sequencing, blockers, gates.
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionTaskDependencyType =
  | "finish_to_start"
  | "start_to_start"
  | "finish_to_finish"
  | "start_to_finish"
  | "blocks"
  | "gated_by"
  | "approval_required"
  | "external_dependency";

export type ExecutionTaskDependencyStatus =
  | "proposed"
  | "active"
  | "resolved"
  | "invalidated";

export type ExecutionTaskDependencyRow = {
  id: string;
  workspace_id: string;
  project_id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: ExecutionTaskDependencyType;
  status: ExecutionTaskDependencyStatus;
  lag_days: number;
  reason: string | null;
  source_type: string;
  source_payload: Record<string, unknown>;
  confidence_score: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const EXECUTION_TASK_DEPENDENCY_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "predecessor_task_id",
  "successor_task_id",
  "dependency_type",
  "status",
  "lag_days",
  "reason",
  "source_type",
  "source_payload",
  "confidence_score",
  "created_by",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ExecutionTaskDependencyRow>;

// ─────────────────────────────────────────────────────────────────────────────
// platform_events — Governance Event Layer
// Migration: 20260616000000_platform_events_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PlatformEventRow = {
  id: string;                        // uuid PK
  workspace_id: string;              // uuid references workspaces
  project_id: string | null;         // uuid references projects (nullable)
  actor_id: string | null;           // uuid (nullable — system events have no actor)
  actor_type: string;                // 'user' | 'ai_agent' | 'system' | 'integration'
  event_type: string;                // e.g. 'RISK_CREATED', 'HUMAN_DECISION_RECORDED'
  event_category: string;            // e.g. 'risk', 'decision', 'recommendation'
  event_payload: Record<string, unknown>;  // structured facts — no raw content
  source: string;                    // 'user_action' | 'ai_agent' | 'system' | ...
  correlation_id: string | null;     // groups related events in a logical flow
  causation_id: string | null;       // platform_events.id that caused this event
  visibility: string;                // 'personal' | 'project' | 'workspace' | ...
  sensitivity_level: string;         // 'public' | 'internal' | 'confidential' | 'restricted'
  learning_eligible: boolean;        // may feed future learning pipelines when true
  raw_reference_table: string | null;  // source table name (no content copied)
  raw_reference_id: string | null;     // source record id (no content copied)
  metadata: Record<string, unknown>;   // request_id, trace_id, session_id, etc.
  occurred_at: string;               // timestamptz — when the event happened
  created_at: string;                // timestamptz — when the row was inserted
};

export const PLATFORM_EVENT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "actor_id",
  "actor_type",
  "event_type",
  "event_category",
  "event_payload",
  "source",
  "correlation_id",
  "causation_id",
  "visibility",
  "sensitivity_level",
  "learning_eligible",
  "raw_reference_table",
  "raw_reference_id",
  "metadata",
  "occurred_at",
  "created_at",
] as const satisfies ReadonlyArray<keyof PlatformEventRow>;

// ─────────────────────────────────────────────────────────────────────────────
// decision_effectiveness — Decision Effectiveness Foundation
// Migration: 20260617030000_decision_effectiveness_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type DecisionEffectivenessStatusRow = "candidate" | "validated" | "archived";
export type DecisionOutcomeClassificationRow = "success" | "partial_success" | "failure" | "unknown";

export type DecisionEffectivenessRow = {
  id: string;                                         // uuid PK
  workspace_id: string;                               // uuid references workspaces
  decision_id: string;                                // uuid references project_decisions
  project_id: string;                                 // uuid references projects
  effectiveness_status: DecisionEffectivenessStatusRow;
  outcome_classification: DecisionOutcomeClassificationRow;
  approval_duration_seconds: number | null;           // bigint null
  implementation_duration_seconds: number | null;     // bigint null
  time_to_outcome_seconds: number | null;             // bigint null
  evidence_count: number;                             // integer not null
  outcome_count: number;                              // integer not null
  pattern_count: number;                              // integer not null
  created_at: string;                                 // timestamptz
  updated_at: string;                                 // timestamptz
  created_by: string | null;                          // uuid null references auth.users
  metadata: Record<string, unknown>;                  // jsonb
};

export const DECISION_EFFECTIVENESS_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "decision_id",
  "project_id",
  "effectiveness_status",
  "outcome_classification",
  "approval_duration_seconds",
  "implementation_duration_seconds",
  "time_to_outcome_seconds",
  "evidence_count",
  "outcome_count",
  "pattern_count",
  "created_at",
  "updated_at",
  "created_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof DecisionEffectivenessRow>;

export type DecisionEffectivenessObservationRow = {
  id: string;               // uuid PK
  effectiveness_id: string; // uuid references decision_effectiveness
  observation_type: string; // text not null
  summary: string;          // text not null
  source_type: string;      // text not null
  source_id: string;        // uuid not null
  recorded_at: string;      // timestamptz
};

export const DECISION_EFFECTIVENESS_OBSERVATION_SELECTABLE_COLUMNS = [
  "id",
  "effectiveness_id",
  "observation_type",
  "summary",
  "source_type",
  "source_id",
  "recorded_at",
] as const satisfies ReadonlyArray<keyof DecisionEffectivenessObservationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// organizational_pattern_candidates — Pattern Extraction Foundation
// Migration: 20260618000000_pattern_extraction_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PatternCandidateStatusRow = "candidate" | "promoted" | "rejected" | "archived";

export type OrganizationalPatternCandidateRow = {
  id: string;                                // uuid PK
  workspace_id: string;                      // uuid references workspaces
  pattern_category: string;                  // text not null (enum-like)
  candidate_title: string;                   // text not null
  candidate_summary: string;                 // text not null
  observation_count: number;                 // integer not null
  confidence: string;                        // text not null (enum-like)
  status: PatternCandidateStatusRow;         // text not null
  rule_id: string;                           // text not null
  promoted_pattern_id: string | null;        // uuid null references organizational_patterns
  created_at: string;                        // timestamptz
  updated_at: string;                        // timestamptz
  metadata: Record<string, unknown>;         // jsonb
};

export const ORGANIZATIONAL_PATTERN_CANDIDATE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pattern_category",
  "candidate_title",
  "candidate_summary",
  "observation_count",
  "confidence",
  "status",
  "rule_id",
  "promoted_pattern_id",
  "created_at",
  "updated_at",
  "metadata",
] as const satisfies ReadonlyArray<keyof OrganizationalPatternCandidateRow>;

// ─────────────────────────────────────────────────────────────────────────────
// pattern_candidate_sources — Pattern Extraction Foundation
// Migration: 20260618000000_pattern_extraction_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PatternCandidateSourceRow = {
  id: string;              // uuid PK
  candidate_id: string;    // uuid references organizational_pattern_candidates
  source_type: string;     // text not null (enum-like)
  source_id: string;       // uuid not null
  source_label: string;    // text not null
  created_at: string;      // timestamptz
};

export const PATTERN_CANDIDATE_SOURCE_SELECTABLE_COLUMNS = [
  "id",
  "candidate_id",
  "source_type",
  "source_id",
  "source_label",
  "created_at",
] as const satisfies ReadonlyArray<keyof PatternCandidateSourceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// pattern_extraction_runs — Pattern Extraction Foundation
// Migration: 20260618000000_pattern_extraction_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PatternExtractionRunRow = {
  id: string;                        // uuid PK
  workspace_id: string;              // uuid references workspaces
  started_at: string;                // timestamptz
  completed_at: string | null;       // timestamptz null
  candidate_count: number;           // integer not null
  rule_count: number;                // integer not null
  metadata: Record<string, unknown>; // jsonb
};

export const PATTERN_EXTRACTION_RUN_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "started_at",
  "completed_at",
  "candidate_count",
  "rule_count",
  "metadata",
] as const satisfies ReadonlyArray<keyof PatternExtractionRunRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_patterns — Personal PM Pattern Formation Foundation
// Migration: 20260619000000_personal_pm_patterns_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmPatternRow = {
  id: string;                        // uuid PK
  workspace_id: string;              // uuid references workspaces
  pm_user_id: string;                // uuid references auth.users
  pattern_category: string;          // text check (allowed categories)
  title: string;                     // text not null
  summary: string;                   // text not null
  confidence: string;                // text check ('low','medium','high','very_high')
  status: string;                    // text check ('active','archived','frozen','deprecated')
  created_at: string;                // timestamptz
  updated_at: string;                // timestamptz
  created_by: string | null;         // uuid references auth.users null
  metadata: Record<string, unknown>; // jsonb
};

export const PERSONAL_PM_PATTERN_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pm_user_id",
  "pattern_category",
  "title",
  "summary",
  "confidence",
  "status",
  "created_at",
  "updated_at",
  "created_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof PersonalPmPatternRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_pattern_sources — Personal PM Pattern Formation Foundation
// Migration: 20260619000000_personal_pm_patterns_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmPatternSourceRow = {
  id: string;                // uuid PK
  pattern_id: string;        // uuid references personal_pm_patterns
  source_type: string;       // text check (allowed source types)
  source_id: string;         // uuid not null
  relationship_type: string; // text check (allowed relationship types)
  created_at: string;        // timestamptz
};

export const PERSONAL_PM_PATTERN_SOURCE_SELECTABLE_COLUMNS = [
  "id",
  "pattern_id",
  "source_type",
  "source_id",
  "relationship_type",
  "created_at",
] as const satisfies ReadonlyArray<keyof PersonalPmPatternSourceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_pattern_observations — Personal PM Pattern Formation Foundation
// Migration: 20260619000000_personal_pm_patterns_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmPatternObservationRow = {
  id: string;                        // uuid PK
  pattern_id: string;                // uuid references personal_pm_patterns
  observation_summary: string;       // text not null
  recorded_at: string;               // timestamptz
  recorded_by: string | null;        // uuid references auth.users null
  metadata: Record<string, unknown>; // jsonb
};

export const PERSONAL_PM_PATTERN_OBSERVATION_SELECTABLE_COLUMNS = [
  "id",
  "pattern_id",
  "observation_summary",
  "recorded_at",
  "recorded_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof PersonalPmPatternObservationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_effectiveness — Personal PM Effectiveness Foundation
// Migration: 20260620000000_personal_pm_effectiveness_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmEffectivenessRow = {
  id: string;                                    // uuid PK
  workspace_id: string;                          // uuid references workspaces
  pm_user_id: string;                            // uuid references auth.users
  personal_pattern_id: string | null;            // uuid references personal_pm_patterns null
  personal_memory_id: string | null;             // uuid references personal_pm_memory null
  decision_id: string | null;                    // uuid references project_decisions null
  decision_effectiveness_id: string | null;      // uuid references decision_effectiveness null
  outcome_classification: string;                // text check ('success','partial_success','failure','unknown')
  effectiveness_status: string;                  // text check ('candidate','validated','archived','deprecated')
  summary: string;                               // text not null
  created_at: string;                            // timestamptz
  updated_at: string;                            // timestamptz
  created_by: string | null;                     // uuid references auth.users null
  metadata: Record<string, unknown>;             // jsonb
};

export const PERSONAL_PM_EFFECTIVENESS_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pm_user_id",
  "personal_pattern_id",
  "personal_memory_id",
  "decision_id",
  "decision_effectiveness_id",
  "outcome_classification",
  "effectiveness_status",
  "summary",
  "created_at",
  "updated_at",
  "created_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof PersonalPmEffectivenessRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_effectiveness_sources — Personal PM Effectiveness Foundation
// Migration: 20260620000000_personal_pm_effectiveness_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmEffectivenessSourceRow = {
  id: string;                // uuid PK
  effectiveness_id: string;  // uuid references personal_pm_effectiveness
  source_type: string;       // text check (allowed source types)
  source_id: string;         // uuid not null
  relationship_type: string; // text check (allowed relationship types)
  created_at: string;        // timestamptz
};

export const PERSONAL_PM_EFFECTIVENESS_SOURCE_SELECTABLE_COLUMNS = [
  "id",
  "effectiveness_id",
  "source_type",
  "source_id",
  "relationship_type",
  "created_at",
] as const satisfies ReadonlyArray<keyof PersonalPmEffectivenessSourceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_effectiveness_observations — Personal PM Effectiveness Foundation
// Migration: 20260620000000_personal_pm_effectiveness_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmEffectivenessObservationRow = {
  id: string;                        // uuid PK
  effectiveness_id: string;          // uuid references personal_pm_effectiveness
  observation_summary: string;       // text not null
  recorded_at: string;               // timestamptz
  recorded_by: string | null;        // uuid references auth.users null
  metadata: Record<string, unknown>; // jsonb
};

export const PERSONAL_PM_EFFECTIVENESS_OBSERVATION_SELECTABLE_COLUMNS = [
  "id",
  "effectiveness_id",
  "observation_summary",
  "recorded_at",
  "recorded_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof PersonalPmEffectivenessObservationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_pattern_candidates — Personal Pattern Extraction Foundation
// Migration: 20260621000000_personal_pattern_extraction_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPatternCandidateStatusRow = "candidate" | "promoted" | "rejected" | "archived";

export type PersonalPmPatternCandidateRow = {
  id: string;                                // uuid PK
  workspace_id: string;                      // uuid references workspaces
  pm_user_id: string;                        // uuid references auth.users — RLS: pm_user_id = auth.uid()
  candidate_category: string;                // text not null (enum-like)
  candidate_title: string;                   // text not null
  candidate_summary: string;                 // text not null
  confidence: string;                        // text not null ('low','medium','high','very_high')
  status: PersonalPatternCandidateStatusRow; // text not null default 'candidate'
  observation_count: number;                 // integer not null
  created_at: string;                        // timestamptz
  updated_at: string;                        // timestamptz
  metadata: Record<string, unknown>;         // jsonb — includes ruleId, groupKey, runId
};

export const PERSONAL_PM_PATTERN_CANDIDATE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pm_user_id",
  "candidate_category",
  "candidate_title",
  "candidate_summary",
  "confidence",
  "status",
  "observation_count",
  "created_at",
  "updated_at",
  "metadata",
] as const satisfies ReadonlyArray<keyof PersonalPmPatternCandidateRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_pattern_candidate_sources — Personal Pattern Extraction Foundation
// Migration: 20260621000000_personal_pattern_extraction_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmPatternCandidateSourceRow = {
  id: string;                // uuid PK
  candidate_id: string;      // uuid references personal_pm_pattern_candidates
  source_type: string;       // text not null (enum-like)
  source_id: string;         // uuid not null
  relationship_type: string; // text not null (enum-like)
  created_at: string;        // timestamptz
};

export const PERSONAL_PM_PATTERN_CANDIDATE_SOURCE_SELECTABLE_COLUMNS = [
  "id",
  "candidate_id",
  "source_type",
  "source_id",
  "relationship_type",
  "created_at",
] as const satisfies ReadonlyArray<keyof PersonalPmPatternCandidateSourceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// personal_pm_pattern_extraction_runs — Personal Pattern Extraction Foundation
// Migration: 20260621000000_personal_pattern_extraction_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type PersonalPmPatternExtractionRunRow = {
  id: string;                        // uuid PK
  workspace_id: string;              // uuid references workspaces
  pm_user_id: string;                // uuid references auth.users — RLS: pm_user_id = auth.uid()
  started_at: string;                // timestamptz
  completed_at: string | null;       // timestamptz null
  candidate_count: number;           // integer not null
  rule_count: number;                // integer not null
  metadata: Record<string, unknown>; // jsonb
};

export const PERSONAL_PM_PATTERN_EXTRACTION_RUN_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pm_user_id",
  "started_at",
  "completed_at",
  "candidate_count",
  "rule_count",
  "metadata",
] as const satisfies ReadonlyArray<keyof PersonalPmPatternExtractionRunRow>;

// ─────────────────────────────────────────────────────────────────────────────
// intelligence_bridge_links — Intelligence Bridge Foundation
// Migration: 20260622000000_intelligence_bridge_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type IntelligenceBridgeLinkRow = {
  id: string;                        // uuid PK
  workspace_id: string;              // uuid references workspaces
  pm_user_id: string;                // uuid references auth.users — RLS: pm_user_id = auth.uid()
  relationship_type: string;         // text not null (enum-constrained)
  status: string;                    // text not null default 'active'
  personal_source_type: string;      // text not null (enum-constrained)
  personal_source_id: string;        // uuid not null
  organizational_source_type: string; // text not null (enum-constrained)
  organizational_source_id: string;  // uuid not null
  summary: string;                   // text not null (non-empty)
  created_at: string;                // timestamptz
  updated_at: string;                // timestamptz
  created_by: string | null;         // uuid references auth.users
  metadata: Record<string, unknown>; // jsonb
};

export const INTELLIGENCE_BRIDGE_LINK_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pm_user_id",
  "relationship_type",
  "status",
  "personal_source_type",
  "personal_source_id",
  "organizational_source_type",
  "organizational_source_id",
  "summary",
  "created_at",
  "updated_at",
  "created_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof IntelligenceBridgeLinkRow>;

// ─────────────────────────────────────────────────────────────────────────────
// intelligence_bridge_sources — Intelligence Bridge Foundation
// Migration: 20260622000000_intelligence_bridge_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type IntelligenceBridgeSourceRow = {
  id: string;                // uuid PK
  bridge_id: string;         // uuid references intelligence_bridge_links
  source_type: string;       // text not null (enum-constrained)
  source_id: string;         // uuid not null
  relationship_type: string; // text not null (enum-constrained)
  created_at: string;        // timestamptz
};

export const INTELLIGENCE_BRIDGE_SOURCE_SELECTABLE_COLUMNS = [
  "id",
  "bridge_id",
  "source_type",
  "source_id",
  "relationship_type",
  "created_at",
] as const satisfies ReadonlyArray<keyof IntelligenceBridgeSourceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// intelligence_bridge_observations — Intelligence Bridge Foundation
// Migration: 20260622000000_intelligence_bridge_foundation.sql
// ─────────────────────────────────────────────────────────────────────────────

export type IntelligenceBridgeObservationRow = {
  id: string;                        // uuid PK
  bridge_id: string;                 // uuid references intelligence_bridge_links
  observation_summary: string;       // text not null (non-empty)
  recorded_at: string;               // timestamptz
  recorded_by: string | null;        // uuid references auth.users
  metadata: Record<string, unknown>; // jsonb
};

export const INTELLIGENCE_BRIDGE_OBSERVATION_SELECTABLE_COLUMNS = [
  "id",
  "bridge_id",
  "observation_summary",
  "recorded_at",
  "recorded_by",
  "metadata",
] as const satisfies ReadonlyArray<keyof IntelligenceBridgeObservationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// Contract version — bump when any row type changes.
// ─────────────────────────────────────────────────────────────────────────────

export const DATABASE_CONTRACT_VERSION = "2026-06-18-platform-events-execution-tasks-decision-effectiveness-pattern-extraction-foundation-personal-pm-patterns-personal-pm-effectiveness-2026-06-21-personal-pattern-extraction-foundation-intelligence-bridge" as const;
