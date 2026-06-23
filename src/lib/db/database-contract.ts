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

// ─────────────────────────────────────────────────────────────────────────────
// project_constitutions — Project Constitution Lifecycle
// Migration: 20260623000000_project_constitution_lifecycle.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "active"
  | "suspended"
  | "closed"
  | "archived";

export type ProjectConstitutionRow = {
  id: string;                    // uuid PK
  workspace_id: string;          // uuid references workspaces
  project_id: string;            // uuid references projects
  title: string;                 // text not null
  description: string | null;    // text
  current_status: ConstitutionStatus; // text not null default 'draft'
  status_changed_at: string;     // timestamptz
  status_changed_by: string;     // uuid references auth.users
  lifecycle_version: number;     // integer >= 1, increments on each transition
  created_by: string;            // uuid references auth.users
  created_at: string;            // timestamptz
  updated_at: string;            // timestamptz
  metadata: Record<string, unknown>; // jsonb
};

export const PROJECT_CONSTITUTION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "title",
  "description",
  "current_status",
  "status_changed_at",
  "status_changed_by",
  "lifecycle_version",
  "created_by",
  "created_at",
  "updated_at",
  "metadata",
] as const satisfies ReadonlyArray<keyof ProjectConstitutionRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitution_lifecycle_history — Project Constitution Lifecycle
// Migration: 20260623000000_project_constitution_lifecycle.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionLifecycleHistoryRow = {
  id: string;                           // uuid PK
  workspace_id: string;                 // uuid references workspaces
  constitution_id: string;              // uuid references project_constitutions
  from_status: ConstitutionStatus;      // text not null
  to_status: ConstitutionStatus;        // text not null
  changed_by: string;                   // uuid references auth.users
  changed_at: string;                   // timestamptz
  reason: string | null;                // text
  lifecycle_version_after: number;      // integer >= 1
  metadata: Record<string, unknown>;    // jsonb
};

export const CONSTITUTION_LIFECYCLE_HISTORY_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "constitution_id",
  "from_status",
  "to_status",
  "changed_by",
  "changed_at",
  "reason",
  "lifecycle_version_after",
  "metadata",
] as const satisfies ReadonlyArray<keyof ConstitutionLifecycleHistoryRow>;

// ─────────────────────────────────────────────────────────────────────────────
// project_constitutions — constitution_version column (Amendment Governance)
// Migration: 20260624000000_project_constitution_amendment_governance.sql
// ─────────────────────────────────────────────────────────────────────────────
// constitution_version is declared as an augmentation of ProjectConstitutionRow.
// The column is added via ALTER TABLE in the amendment governance migration.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectConstitutionWithVersionRow = ProjectConstitutionRow & {
  constitution_version: number; // integer >= 1, increments per applied amendment
};

// ─────────────────────────────────────────────────────────────────────────────
// constitution_amendments — Amendment Governance
// Migration: 20260624000000_project_constitution_amendment_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type AmendmentStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "applied";

export type ConstitutionAmendmentRow = {
  id: string;                         // uuid PK
  workspace_id: string;               // uuid references workspaces
  constitution_id: string;            // uuid references project_constitutions

  title: string;                      // text not null
  description: string | null;         // text
  justification: string | null;       // text

  status: AmendmentStatus;            // text not null default 'draft'

  created_by: string;                 // uuid references auth.users
  created_at: string;                 // timestamptz
  updated_at: string;                 // timestamptz

  approved_by: string | null;         // uuid references auth.users
  approved_at: string | null;         // timestamptz

  rejected_by: string | null;         // uuid references auth.users
  rejected_at: string | null;         // timestamptz
  rejection_reason: string | null;    // text

  withdrawn_by: string | null;        // uuid references auth.users
  withdrawn_at: string | null;        // timestamptz

  applied_by: string | null;          // uuid references auth.users
  applied_at: string | null;          // timestamptz

  deleted_at: string | null;          // timestamptz
};

export const CONSTITUTION_AMENDMENT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "constitution_id",
  "title",
  "description",
  "justification",
  "status",
  "created_by",
  "created_at",
  "updated_at",
  "approved_by",
  "approved_at",
  "rejected_by",
  "rejected_at",
  "rejection_reason",
  "withdrawn_by",
  "withdrawn_at",
  "applied_by",
  "applied_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ConstitutionAmendmentRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitution_amendment_changes — Amendment Change Records
// Migration: 20260624000000_project_constitution_amendment_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type AmendmentChangeType = "add" | "update" | "remove";

export type ConstitutionAmendmentChangeRow = {
  id: string;                       // uuid PK
  workspace_id: string;             // uuid references workspaces
  amendment_id: string;             // uuid references constitution_amendments

  change_type: AmendmentChangeType; // 'add' | 'update' | 'remove'
  field_name: string;               // text not null

  old_value: string | null;         // text
  new_value: string | null;         // text

  created_at: string;               // timestamptz
};

export const CONSTITUTION_AMENDMENT_CHANGE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "amendment_id",
  "change_type",
  "field_name",
  "old_value",
  "new_value",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionAmendmentChangeRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitution_snapshots — Constitutional Snapshots
// Migration: 20260624000000_project_constitution_amendment_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionSnapshotRow = {
  id: string;                         // uuid PK
  workspace_id: string;               // uuid references workspaces
  constitution_id: string;            // uuid references project_constitutions

  version: number;                    // integer >= 1 (matches constitution_version)

  snapshot_data: Record<string, unknown>; // jsonb — full constitution state

  created_by: string;                 // uuid references auth.users
  created_at: string;                 // timestamptz
};

export const CONSTITUTION_SNAPSHOT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "constitution_id",
  "version",
  "snapshot_data",
  "created_by",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionSnapshotRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_decisions — Constitutional Decision Governance
// Migration: 20260625000000_project_constitutional_decision_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalDecisionStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "rejected"
  | "executed"
  | "cancelled";

export type ConstitutionalDecisionType =
  | "scope"
  | "schedule"
  | "cost"
  | "quality"
  | "risk"
  | "resource"
  | "architecture"
  | "governance"
  | "constitutional"
  | "technical"
  | "vendor"
  | "operational";

export type ConstitutionalDecisionAuthority =
  | "sponsor"
  | "project_manager"
  | "steering_committee"
  | "governance_board"
  | "product_owner"
  | "client"
  | "architect"
  | "technical_lead";

export type ConstitutionalDecisionRow = {
  id: string;                                     // uuid PK
  workspace_id: string;                           // uuid references workspaces
  constitution_id: string;                        // uuid references project_constitutions

  title: string;                                  // text not null
  description: string | null;                     // text

  decision_type: ConstitutionalDecisionType;      // text not null (enum-constrained)

  context: string | null;                         // text
  problem_statement: string | null;               // text

  recommended_option: string | null;              // text
  selected_option: string | null;                 // text

  decision_authority: ConstitutionalDecisionAuthority; // text not null (enum-constrained)

  status: ConstitutionalDecisionStatus;           // text not null default 'draft'

  created_by: string;                             // uuid references auth.users
  created_at: string;                             // timestamptz
  updated_at: string;                             // timestamptz

  approved_by: string | null;                     // uuid references auth.users
  approved_at: string | null;                     // timestamptz

  executed_by: string | null;                     // uuid references auth.users
  executed_at: string | null;                     // timestamptz

  cancelled_by: string | null;                    // uuid references auth.users
  cancelled_at: string | null;                    // timestamptz

  deleted_at: string | null;                      // timestamptz
};

export const CONSTITUTIONAL_DECISION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "constitution_id",
  "title",
  "description",
  "decision_type",
  "context",
  "problem_statement",
  "recommended_option",
  "selected_option",
  "decision_authority",
  "status",
  "created_by",
  "created_at",
  "updated_at",
  "approved_by",
  "approved_at",
  "executed_by",
  "executed_at",
  "cancelled_by",
  "cancelled_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalDecisionRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_decision_options — Decision Options
// Migration: 20260625000000_project_constitutional_decision_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalDecisionOptionRow = {
  id: string;                   // uuid PK
  workspace_id: string;         // uuid references workspaces
  decision_id: string;          // uuid references constitutional_decisions

  name: string;                 // text not null
  description: string | null;   // text

  advantages: string | null;    // text
  disadvantages: string | null; // text

  estimated_cost: string | null;   // text
  estimated_effort: string | null; // text

  selected: boolean;            // boolean not null default false

  created_at: string;           // timestamptz
};

export const CONSTITUTIONAL_DECISION_OPTION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "decision_id",
  "name",
  "description",
  "advantages",
  "disadvantages",
  "estimated_cost",
  "estimated_effort",
  "selected",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalDecisionOptionRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_decision_evidence — Evidence Registry
// Migration: 20260625000000_project_constitutional_decision_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalDecisionEvidenceType =
  | "document"
  | "email"
  | "meeting"
  | "risk"
  | "issue"
  | "change_request"
  | "file"
  | "link"
  | "chat"
  | "approval";

export type ConstitutionalDecisionEvidenceRow = {
  id: string;                                          // uuid PK
  workspace_id: string;                                // uuid references workspaces
  decision_id: string;                                 // uuid references constitutional_decisions

  evidence_type: ConstitutionalDecisionEvidenceType;   // text not null (enum-constrained)

  reference_id: string | null;                         // text — external ref

  description: string;                                 // text not null

  created_by: string;                                  // uuid references auth.users
  created_at: string;                                  // timestamptz
};

export const CONSTITUTIONAL_DECISION_EVIDENCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "decision_id",
  "evidence_type",
  "reference_id",
  "description",
  "created_by",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalDecisionEvidenceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_decision_links — Constitutional Linkage
// Migration: 20260625000000_project_constitutional_decision_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalDecisionLinkType =
  | "objective"
  | "constraint"
  | "amendment"
  | "risk"
  | "issue"
  | "milestone"
  | "deliverable"
  | "constitution_version";

export type ConstitutionalDecisionLinkRow = {
  id: string;                                       // uuid PK
  workspace_id: string;                             // uuid references workspaces
  decision_id: string;                              // uuid references constitutional_decisions

  link_type: ConstitutionalDecisionLinkType;        // text not null (enum-constrained)

  linked_entity_id: string;                         // uuid not null

  created_at: string;                               // timestamptz
};

export const CONSTITUTIONAL_DECISION_LINK_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "decision_id",
  "link_type",
  "linked_entity_id",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalDecisionLinkRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_signatures
// Source: 20260626000000_constitutional_ratification_framework.sql
// ─────────────────────────────────────────────────────────────────────────────

export type SignatureStatus = "pending" | "signed" | "rejected" | "expired" | "withdrawn";
export type SignatureAuthorityType =
  | "sponsor"
  | "project_manager"
  | "client"
  | "steering_committee"
  | "governance_board"
  | "product_owner"
  | "architect"
  | "technical_lead"
  | "external_approver";
export type RatifiableEntityType = "constitution" | "amendment" | "decision";

export type ConstitutionalSignatureRow = {
  id: string;              // uuid
  workspace_id: string;    // uuid
  entity_type: RatifiableEntityType;
  entity_id: string;       // uuid
  entity_version: number;  // integer
  authority_type: SignatureAuthorityType;
  authority_id: string;    // uuid references auth.users
  status: SignatureStatus;
  signature_hash: string | null;
  comments: string | null;
  requested_at: string;    // timestamptz
  signed_at: string | null;
  rejected_at: string | null;
  expired_at: string | null;
  withdrawn_at: string | null;
  created_by: string;      // uuid
  created_at: string;
  updated_at: string;
};

export const CONSTITUTIONAL_SIGNATURE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "entity_type",
  "entity_id",
  "entity_version",
  "authority_type",
  "authority_id",
  "status",
  "signature_hash",
  "comments",
  "requested_at",
  "signed_at",
  "rejected_at",
  "expired_at",
  "withdrawn_at",
  "created_by",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalSignatureRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_signature_requests
// Source: 20260626000000_constitutional_ratification_framework.sql
// ─────────────────────────────────────────────────────────────────────────────

export type SignatureRequestStatus = "pending" | "fulfilled" | "declined" | "expired";

export type ConstitutionalSignatureRequestRow = {
  id: string;
  workspace_id: string;
  entity_type: RatifiableEntityType;
  entity_id: string;
  requested_authority: SignatureAuthorityType;
  requested_by: string;
  status: SignatureRequestStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
};

export const CONSTITUTIONAL_SIGNATURE_REQUEST_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "entity_type",
  "entity_id",
  "requested_authority",
  "requested_by",
  "status",
  "deadline",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalSignatureRequestRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_ratification_policies
// Source: 20260626000000_constitutional_ratification_framework.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalRatificationPolicyRow = {
  id: string;
  workspace_id: string;
  entity_type: RatifiableEntityType;
  minimum_signatures: number;
  required_authorities: SignatureAuthorityType[];
  allow_unanimous_override: boolean;
  created_at: string;
};

export const CONSTITUTIONAL_RATIFICATION_POLICY_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "entity_type",
  "minimum_signatures",
  "required_authorities",
  "allow_unanimous_override",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRatificationPolicyRow>;

// ─────────────────────────────────────────────────────────────────────────────
// authority_registrations
// Source: 20260627000000_authority_registry_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type AuthorityType =
  | "sponsor"
  | "project_manager"
  | "technical_lead"
  | "steering_committee"
  | "governance_board"
  | "product_owner"
  | "architect"
  | "client"
  | "external_approver";

export type AuthorityScope = "workspace" | "project";

export type AuthorityStatus = "active" | "revoked" | "expired";

export type AuthorityRegistrationRow = {
  id: string;                      // uuid PK
  workspace_id: string;            // uuid references workspaces
  actor_id: string;                // uuid references auth.users
  authority_type: AuthorityType;   // text not null (enum-constrained)
  authority_scope: AuthorityScope; // text not null default 'project'
  project_id: string | null;       // uuid nullable
  valid_from: string;              // timestamptz
  valid_until: string | null;      // timestamptz nullable
  status: AuthorityStatus;         // text not null default 'active'
  revoked_at: string | null;       // timestamptz nullable
  revoked_by: string | null;       // uuid nullable
  revocation_reason: string | null;// text nullable
  granted_by: string;              // uuid references auth.users
  created_at: string;              // timestamptz
  updated_at: string;              // timestamptz
};

export const AUTHORITY_REGISTRATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "actor_id",
  "authority_type",
  "authority_scope",
  "project_id",
  "valid_from",
  "valid_until",
  "status",
  "revoked_at",
  "revoked_by",
  "revocation_reason",
  "granted_by",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof AuthorityRegistrationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// authority_delegations
// Source: 20260627000000_authority_registry_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type DelegationStatus = "active" | "revoked" | "expired";

export type AuthorityDelegationRow = {
  id: string;                         // uuid PK
  workspace_id: string;               // uuid references workspaces
  delegator_id: string;               // uuid references auth.users
  delegator_authority: AuthorityType; // text not null (enum-constrained)
  delegate_id: string;                // uuid references auth.users
  delegate_authority: AuthorityType;  // text not null (enum-constrained)
  project_id: string | null;          // uuid nullable
  valid_from: string;                 // timestamptz
  valid_until: string | null;         // timestamptz nullable
  status: DelegationStatus;           // text not null default 'active'
  revoked_at: string | null;          // timestamptz nullable
  revoked_by: string | null;          // uuid nullable
  revocation_reason: string | null;   // text nullable
  delegation_depth: number;           // integer default 1 (1–3)
  parent_delegation_id: string | null;// uuid nullable self-ref
  created_by: string;                 // uuid references auth.users
  created_at: string;                 // timestamptz
  updated_at: string;                 // timestamptz
};

export const AUTHORITY_DELEGATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "delegator_id",
  "delegator_authority",
  "delegate_id",
  "delegate_authority",
  "project_id",
  "valid_from",
  "valid_until",
  "status",
  "revoked_at",
  "revoked_by",
  "revocation_reason",
  "delegation_depth",
  "parent_delegation_id",
  "created_by",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof AuthorityDelegationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_violations
// Source: 20260627000000_authority_registry_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceViolationType =
  | "unauthorized_approval"
  | "unauthorized_amendment"
  | "unauthorized_ratification"
  | "expired_authority"
  | "revoked_authority"
  | "missing_authority_registration"
  | "delegation_depth_exceeded";

export type GovernanceViolationSeverity = "low" | "medium" | "high" | "critical";
export type GovernanceViolationStatus = "open" | "acknowledged" | "resolved" | "escalated";

export type GovernanceViolationRow = {
  id: string;                                   // uuid PK
  workspace_id: string;                         // uuid references workspaces
  violation_type: GovernanceViolationType;      // text not null (enum-constrained)
  action_type: string;                          // text not null
  action_entity_type: string;                   // text not null
  action_entity_id: string;                     // uuid not null
  actor_id: string;                             // uuid references auth.users
  actor_authority: string | null;               // text nullable
  required_authority: string | null;            // text nullable
  authority_id: string | null;                  // uuid nullable
  severity: GovernanceViolationSeverity;        // text not null default 'high'
  status: GovernanceViolationStatus;            // text not null default 'open'
  resolved_at: string | null;                   // timestamptz nullable
  resolved_by: string | null;                   // uuid nullable
  resolution_notes: string | null;              // text nullable
  detected_at: string;                          // timestamptz
  created_at: string;                           // timestamptz
  updated_at: string;                           // timestamptz
};

export const GOVERNANCE_VIOLATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "violation_type",
  "action_type",
  "action_entity_type",
  "action_entity_id",
  "actor_id",
  "actor_authority",
  "required_authority",
  "authority_id",
  "severity",
  "status",
  "resolved_at",
  "resolved_by",
  "resolution_notes",
  "detected_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof GovernanceViolationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// authority_escalations
// Source: 20260627000000_authority_registry_governance.sql
// ─────────────────────────────────────────────────────────────────────────────

export type EscalationTriggerType =
  | "no_authority_holder"
  | "governance_violation"
  | "authority_gap"
  | "delegation_chain_broken"
  | "manual";

export type EscalationTarget = "governance_board" | "steering_committee" | "sponsor" | "external_approver";
export type EscalationStatus = "pending" | "acknowledged" | "resolved" | "closed";

export type AuthorityEscalationRow = {
  id: string;                             // uuid PK
  workspace_id: string;                   // uuid references workspaces
  trigger_type: EscalationTriggerType;    // text not null (enum-constrained)
  action_entity_type: string;             // text not null
  action_entity_id: string;              // uuid not null
  action_type: string;                    // text not null
  required_authority: string;             // text not null
  escalated_to: EscalationTarget;         // text not null default 'governance_board'
  escalated_by: string;                   // uuid references auth.users
  status: EscalationStatus;              // text not null default 'pending'
  resolution: string | null;              // text nullable
  resolved_by: string | null;             // uuid nullable
  resolved_at: string | null;             // timestamptz nullable
  violation_id: string | null;            // uuid nullable references governance_violations
  created_at: string;                     // timestamptz
  updated_at: string;                     // timestamptz
};

export const AUTHORITY_ESCALATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "trigger_type",
  "action_entity_type",
  "action_entity_id",
  "action_type",
  "required_authority",
  "escalated_to",
  "escalated_by",
  "status",
  "resolution",
  "resolved_by",
  "resolved_at",
  "violation_id",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof AuthorityEscalationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Vault — EPIC 2 Sprint 1
// ─────────────────────────────────────────────────────────────────────────────

export type ArtifactType =
  | "document"
  | "email"
  | "meeting"
  | "transcript"
  | "spreadsheet"
  | "image"
  | "video"
  | "link"
  | "chat"
  | "other";

export type StorageProvider =
  | "local"
  | "supabase"
  | "s3"
  | "azure_blob"
  | "google_drive"
  | "sharepoint"
  | "dropbox"
  | "custom";

export type MemoryType =
  | "decision"
  | "objective"
  | "constraint"
  | "risk"
  | "issue"
  | "amendment"
  | "ratification"
  | "authority"
  | "evidence"
  | "other";

export type MemoryLinkEntityType =
  | "constitution"
  | "decision"
  | "amendment"
  | "ratification"
  | "authority"
  | "violation"
  | "escalation";

export type ConstitutionalArtifactRow = {
  id: string;                        // uuid primary key
  workspace_id: string;              // uuid references workspaces
  artifact_type: ArtifactType;       // text not null (enum-constrained)
  title: string;                     // text not null
  description: string | null;        // text nullable
  storage_provider: StorageProvider; // text not null (enum-constrained)
  storage_reference: string;         // text not null
  storage_path: string | null;       // text nullable
  checksum: string;                  // text not null
  uploaded_by: string;               // uuid references auth.users
  created_at: string;                // timestamptz
  deleted_at: string | null;         // timestamptz nullable (soft delete)
};

export const CONSTITUTIONAL_ARTIFACT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "artifact_type",
  "title",
  "description",
  "storage_provider",
  "storage_reference",
  "storage_path",
  "checksum",
  "uploaded_by",
  "created_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalArtifactRow>;

export type ConstitutionalMemoryRecordRow = {
  id: string;              // uuid primary key
  workspace_id: string;    // uuid references workspaces
  artifact_id: string;     // uuid references constitutional_artifacts
  memory_type: MemoryType; // text not null (enum-constrained)
  title: string;           // text not null
  canonical_text: string;  // text not null
  summary: string | null;  // text nullable
  created_at: string;      // timestamptz
  created_by: string;      // uuid references auth.users
};

export const CONSTITUTIONAL_MEMORY_RECORD_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "artifact_id",
  "memory_type",
  "title",
  "canonical_text",
  "summary",
  "created_at",
  "created_by",
] as const satisfies ReadonlyArray<keyof ConstitutionalMemoryRecordRow>;

export type ConstitutionalMemoryLinkRow = {
  id: string;                        // uuid primary key
  workspace_id: string;              // uuid references workspaces
  memory_record_id: string;          // uuid references constitutional_memory_records
  entity_type: MemoryLinkEntityType; // text not null (enum-constrained)
  entity_id: string;                 // uuid not null
  created_at: string;                // timestamptz
};

export const CONSTITUTIONAL_MEMORY_LINK_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "memory_record_id",
  "entity_type",
  "entity_id",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalMemoryLinkRow>;

// ─────────────────────────────────────────────────────────────────────────────
// Contract version — bump when any row type changes.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_digests
// Source: 20260619000002_constitutional_digest_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type DigestStatus =
  | "draft"
  | "generated"
  | "validated"
  | "published"
  | "archived";

export type DigestPayload = {
  project_type?: string;
  industry?: string;
  decision_patterns?: string[];
  risk_patterns?: string[];
  governance_patterns?: string[];
  outcome_patterns?: string[];
};

export type ConstitutionalDigestRow = {
  id: string;                     // uuid primary key
  workspace_id: string;           // uuid references workspaces
  memory_record_id: string;       // uuid references constitutional_memory_records
  digest_version: number;         // integer >= 1
  digest_status: DigestStatus;    // text enum-constrained
  source_memory_version: number;  // integer >= 1
  digest_payload: DigestPayload;  // jsonb
  confidence_score: number | null; // numeric(4,3) nullable
  created_at: string;             // timestamptz
  created_by: string;             // uuid references auth.users
  deleted_at: string | null;      // timestamptz nullable (soft delete)
};

export const CONSTITUTIONAL_DIGEST_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "memory_record_id",
  "digest_version",
  "digest_status",
  "source_memory_version",
  "digest_payload",
  "confidence_score",
  "created_at",
  "created_by",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalDigestRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_digest_classifications
// Source: 20260619000002_constitutional_digest_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type DigestClassificationType =
  | "industry"
  | "project_type"
  | "risk"
  | "decision"
  | "outcome"
  | "governance"
  | "delivery"
  | "authority";

export type ConstitutionalDigestClassificationRow = {
  id: string;                              // uuid primary key
  workspace_id: string;                    // uuid references workspaces
  digest_id: string;                       // uuid references constitutional_digests
  classification_type: DigestClassificationType;  // text enum-constrained
  classification_value: string;            // text not null
  confidence_score: number;               // numeric(4,3) 0.0–1.0
  created_at: string;                     // timestamptz
};

export const CONSTITUTIONAL_DIGEST_CLASSIFICATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "digest_id",
  "classification_type",
  "classification_value",
  "confidence_score",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalDigestClassificationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// programs
// Source: 20260628000000_programs.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramType =
  | "SOFTWARE_DEVELOPMENT"
  | "INFRASTRUCTURE_PROJECT"
  | "CUSTOMER_ONBOARDING"
  | "AOC_PROTOCOL_ADOPTION"
  | "ORGANIZATIONAL_CHANGE"
  | "STRATEGIC_INITIATIVE"
  | "INTERNAL_PROGRAM"
  | "CUSTOM";

export type ProgramStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED";

export type ProgramRow = {
  id: string;                   // uuid
  workspace_id: string;         // uuid references workspaces
  name: string;                 // text 1–200
  description: string | null;   // text 0–5000
  type: ProgramType;            // text enum-constrained
  status: ProgramStatus;        // text enum-constrained default 'DRAFT'
  owner_id: string | null;      // uuid references auth.users
  start_date: string | null;    // timestamptz
  target_date: string | null;   // timestamptz
  created_at: string;           // timestamptz
  updated_at: string;           // timestamptz
  deleted_at: string | null;    // timestamptz (soft delete)
};

export const PROGRAM_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "name",
  "description",
  "type",
  "status",
  "owner_id",
  "start_date",
  "target_date",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramRow>;

// ─────────────────────────────────────────────────────────────────────────────
// program_epics
// Source: 20260629000000_program_hierarchy.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramItemStatus =
  | "DRAFT"
  | "BACKLOG"
  | "READY"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE"
  | "ARCHIVED";

export type ProgramEpicRow = {
  id: string;                 // uuid
  workspace_id: string;       // uuid references workspaces
  program_id: string;         // uuid references programs
  number: number;             // integer unique per program
  title: string;              // text 1–200
  description: string | null; // text
  status: ProgramItemStatus;  // text enum-constrained default 'DRAFT'
  order_index: number;        // integer
  created_at: string;         // timestamptz
  updated_at: string;         // timestamptz
  deleted_at: string | null;  // timestamptz (soft delete)
};

export const PROGRAM_EPIC_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "program_id",
  "number",
  "title",
  "description",
  "status",
  "order_index",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramEpicRow>;

// ─────────────────────────────────────────────────────────────────────────────
// program_sprints
// Source: 20260629000000_program_hierarchy.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramSprintRow = {
  id: string;                 // uuid
  workspace_id: string;       // uuid references workspaces
  program_id: string;         // uuid references programs
  epic_id: string;            // uuid references program_epics
  number: number;             // integer unique per program
  title: string;              // text 1–200
  description: string | null; // text
  objective: string | null;   // text
  status: ProgramItemStatus;  // text enum-constrained default 'DRAFT'
  order_index: number;        // integer
  created_at: string;         // timestamptz
  updated_at: string;         // timestamptz
  deleted_at: string | null;  // timestamptz (soft delete)
};

export const PROGRAM_SPRINT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "program_id",
  "epic_id",
  "number",
  "title",
  "description",
  "objective",
  "status",
  "order_index",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramSprintRow>;

// ─────────────────────────────────────────────────────────────────────────────
// program_cards
// Source: 20260629000000_program_hierarchy.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramCardType =
  | "EPIC"
  | "SPRINT"
  | "TASK"
  | "PROMPT"
  | "MILESTONE"
  | "DELIVERABLE"
  | "CUSTOM";

export type ProgramCardMaterializationType = "CAPABILITY" | "DELIVERABLE";

export type ProgramBoardColumn =
  | "BACKLOG"
  | "READY"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE";

export type ProgramCardRow = {
  id: string;                 // uuid
  workspace_id: string;       // uuid references workspaces
  program_id: string;         // uuid references programs
  epic_id: string | null;     // uuid references program_epics (nullable)
  sprint_id: string | null;   // uuid references program_sprints (nullable)
  title: string;              // text 1–200
  description: string | null; // text
  prompt_body: string | null; // text (preserve formatting, never modify)
  type: ProgramCardType;      // text enum-constrained
  status: ProgramItemStatus;  // text enum-constrained default 'DRAFT'
  order_index: number;        // integer
  // Materialization tracing (added 20260701000000_program_materializations.sql)
  materialization_source: string | null;           // text — materialization id that created this card
  materialization_type: ProgramCardMaterializationType | null; // text enum-constrained
  source_line_number: number | null;               // integer — line in source roadmap
  // Context projection (added 20260703000000_program_card_context_projection.sql)
  materialization_id: string | null;               // uuid references program_materializations
  // Execution board (added 20260702000000_program_execution_board.sql)
  board_column: ProgramBoardColumn;                // text enum-constrained default 'BACKLOG'
  created_at: string;         // timestamptz
  updated_at: string;         // timestamptz
  deleted_at: string | null;  // timestamptz (soft delete)
};

export const PROGRAM_CARD_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "program_id",
  "epic_id",
  "sprint_id",
  "title",
  "description",
  "prompt_body",
  "type",
  "status",
  "order_index",
  "materialization_source",
  "materialization_type",
  "source_line_number",
  "materialization_id",
  "board_column",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramCardRow>;

// ─────────────────────────────────────────────────────────────────────────────
// program_roadmap_sources
// Source: 20260621100000_program_roadmap_sources.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramRoadmapSourceType =
  | "TEXT"
  | "MARKDOWN"
  | "CLAUDE_PLAN"
  | "AOC_PLAN"
  | "INFRASTRUCTURE_PLAN"
  | "CUSTOM";

export type ProgramRoadmapSourceStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUPERSEDED"
  | "ARCHIVED";

export type ProgramRoadmapSourceRow = {
  id: string;                          // uuid
  workspace_id: string;                // uuid references workspaces
  program_id: string;                  // uuid references programs
  raw_text: string;                    // text 1–500000 (preserved exactly)
  source_type: ProgramRoadmapSourceType; // text enum-constrained
  title: string | null;                // text 1–200
  version: number;                     // integer positive, incremental per program
  status: ProgramRoadmapSourceStatus;  // text enum-constrained default 'DRAFT'
  metadata: Record<string, unknown> | null; // jsonb
  created_by: string | null;           // uuid references auth.users
  created_at: string;                  // timestamptz
  updated_at: string;                  // timestamptz
  deleted_at: string | null;           // timestamptz (soft delete)
};

export const PROGRAM_ROADMAP_SOURCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "program_id",
  "raw_text",
  "source_type",
  "title",
  "version",
  "status",
  "metadata",
  "created_by",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramRoadmapSourceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// program_roadmap_parse_results
// Source: 20260630000000_program_roadmap_parse_results.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramRoadmapParseStatus =
  | "VALID"
  | "VALID_WITH_WARNINGS"
  | "INVALID";

export type ProgramRoadmapParseResultRow = {
  id: string;               // uuid
  workspace_id: string;     // uuid references workspaces
  program_id: string;       // uuid references programs
  source_id: string;        // uuid references program_roadmap_sources
  status: ProgramRoadmapParseStatus; // text enum-constrained
  result_json: Record<string, unknown>; // jsonb — full parse result
  error_count: number;      // integer >= 0
  warning_count: number;    // integer >= 0
  epic_count: number;       // integer >= 0
  sprint_count: number;     // integer >= 0
  parsed_at: string;        // timestamptz
  created_at: string;       // timestamptz
  updated_at: string;       // timestamptz
  deleted_at: string | null; // timestamptz (soft delete)
};

export const PROGRAM_ROADMAP_PARSE_RESULT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "program_id",
  "source_id",
  "status",
  "result_json",
  "error_count",
  "warning_count",
  "epic_count",
  "sprint_count",
  "parsed_at",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramRoadmapParseResultRow>;

// ─────────────────────────────────────────────────────────────────────────────
// program_materializations
// Source: 20260701000000_program_materializations.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ProgramMaterializationStatus =
  | "NOT_STARTED"
  | "RUNNING"
  | "COMPLETED"
  | "ARCHIVED";

export type ProgramMaterializationRow = {
  id: string;              // uuid
  workspace_id: string;    // uuid references workspaces
  program_id: string;      // uuid references programs
  source_id: string;       // uuid references program_roadmap_sources
  parse_result_id: string; // uuid references program_roadmap_parse_results
  status: ProgramMaterializationStatus; // text enum-constrained
  epics_created: number;   // integer >= 0
  sprints_created: number; // integer >= 0
  cards_created: number;   // integer >= 0
  started_at: string | null;   // timestamptz
  completed_at: string | null; // timestamptz
  created_at: string;      // timestamptz
  updated_at: string;      // timestamptz
  deleted_at: string | null; // timestamptz (soft delete)
};

export const PROGRAM_MATERIALIZATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "program_id",
  "source_id",
  "parse_result_id",
  "status",
  "epics_created",
  "sprints_created",
  "cards_created",
  "started_at",
  "completed_at",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ProgramMaterializationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_learning_patterns
// Source: 20260622000001_constitutional_learning_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type LearningPatternType =
  | "decision_pattern"
  | "risk_pattern"
  | "governance_pattern"
  | "authority_pattern"
  | "amendment_pattern"
  | "delivery_pattern"
  | "outcome_pattern";

export type ConstitutionalLearningPatternRow = {
  id: string;                       // uuid primary key
  workspace_id: string;             // uuid references workspaces
  pattern_type: LearningPatternType; // text enum-constrained
  pattern_key: string;              // text not null
  description: string;              // text not null
  confidence_score: number;         // numeric(4,3) 0.0–1.0
  occurrence_count: number;         // integer >= 1
  first_seen_at: string;            // timestamptz
  last_seen_at: string;             // timestamptz
  created_at: string;               // timestamptz
  updated_at: string;               // timestamptz
};

export const CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "pattern_type",
  "pattern_key",
  "description",
  "confidence_score",
  "occurrence_count",
  "first_seen_at",
  "last_seen_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalLearningPatternRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_learning_evidence
// Source: 20260622000001_constitutional_learning_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalLearningEvidenceRow = {
  id: string;                   // uuid primary key
  workspace_id: string;         // uuid references workspaces
  learning_pattern_id: string;  // uuid references constitutional_learning_patterns
  digest_id: string;            // uuid references constitutional_digests
  contribution_weight: number;  // numeric(4,3) 0.0–1.0
  created_at: string;           // timestamptz
};

export const CONSTITUTIONAL_LEARNING_EVIDENCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "learning_pattern_id",
  "digest_id",
  "contribution_weight",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalLearningEvidenceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_learning_recommendations
// Source: 20260622000001_constitutional_learning_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalLearningRecommendationRow = {
  id: string;                   // uuid primary key
  workspace_id: string;         // uuid references workspaces
  learning_pattern_id: string;  // uuid references constitutional_learning_patterns
  recommendation: string;       // text not null
  confidence_score: number;     // numeric(4,3) 0.0–1.0
  created_at: string;           // timestamptz
};

export const CONSTITUTIONAL_LEARNING_RECOMMENDATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "learning_pattern_id",
  "recommendation",
  "confidence_score",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalLearningRecommendationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_recommendations
// Source: 20260622000002_sovereign_recommendation_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationType =
  | "risk_mitigation"
  | "governance_control"
  | "decision_guidance"
  | "authority_control"
  | "delivery_improvement"
  | "ratification_control"
  | "amendment_guidance"
  | "portfolio_guidance";

export type RecommendationScope =
  | "project"
  | "decision"
  | "risk"
  | "governance"
  | "amendment"
  | "authority"
  | "ratification"
  | "delivery"
  | "portfolio";

export type RecommendationStatus =
  | "draft"
  | "generated"
  | "validated"
  | "published"
  | "retired"
  | "deprecated";

export type RecommendationApplicationEntityType =
  | "constitution"
  | "decision"
  | "amendment"
  | "risk"
  | "authority"
  | "project";

export type RecommendationApplicationStatus =
  | "applied"
  | "dismissed"
  | "superseded";

export type ConstitutionalRecommendationRow = {
  id: string;                       // uuid primary key
  workspace_id: string;             // uuid references workspaces
  recommendation_key: string;       // text not null
  recommendation_type: RecommendationType; // text enum-constrained
  recommendation_scope: RecommendationScope; // text enum-constrained
  title: string;                    // text not null
  description: string;              // text not null
  recommendation_text: string;      // text not null
  confidence_score: number;         // numeric(4,3) 0.0–1.0
  supporting_pattern_count: number; // integer >= 0
  status: RecommendationStatus;     // text enum-constrained
  created_at: string;               // timestamptz
  updated_at: string;               // timestamptz
  deleted_at: string | null;        // timestamptz nullable
};

export const CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "recommendation_key",
  "recommendation_type",
  "recommendation_scope",
  "title",
  "description",
  "recommendation_text",
  "confidence_score",
  "supporting_pattern_count",
  "status",
  "created_at",
  "updated_at",
  "deleted_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRecommendationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_recommendation_evidence
// Source: 20260622000002_sovereign_recommendation_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalRecommendationEvidenceRow = {
  id: string;                   // uuid primary key
  workspace_id: string;         // uuid references workspaces
  recommendation_id: string;    // uuid references constitutional_recommendations
  learning_pattern_id: string;  // uuid references constitutional_learning_patterns
  contribution_weight: number;  // numeric(4,3) 0.0–1.0
  created_at: string;           // timestamptz
};

export const CONSTITUTIONAL_RECOMMENDATION_EVIDENCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "recommendation_id",
  "learning_pattern_id",
  "contribution_weight",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRecommendationEvidenceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_recommendation_applications
// Source: 20260622000002_sovereign_recommendation_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalRecommendationApplicationRow = {
  id: string;                // uuid primary key
  workspace_id: string;      // uuid references workspaces
  recommendation_id: string; // uuid references constitutional_recommendations
  entity_type: RecommendationApplicationEntityType; // text enum-constrained
  entity_id: string;         // uuid
  application_status: RecommendationApplicationStatus; // text enum-constrained
  applied_at: string;        // timestamptz
  created_at: string;        // timestamptz
};

export const CONSTITUTIONAL_RECOMMENDATION_APPLICATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "recommendation_id",
  "entity_type",
  "entity_id",
  "application_status",
  "applied_at",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRecommendationApplicationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_recommendation_outcomes
// Source: 20260622000003_recommendation_effectiveness_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationOutcomeType =
  | "risk_reduction"
  | "schedule_improvement"
  | "cost_reduction"
  | "quality_improvement"
  | "governance_improvement"
  | "delivery_improvement"
  | "authority_improvement"
  | "ratification_improvement";

export type RecommendationOutcomeStatus =
  | "successful"
  | "neutral"
  | "failed"
  | "unknown";

export type ConstitutionalRecommendationOutcomeRow = {
  id: string;                  // uuid primary key
  workspace_id: string;        // uuid references workspaces
  recommendation_id: string;   // uuid references constitutional_recommendations
  application_id: string;      // uuid references constitutional_recommendation_applications
  outcome_type: RecommendationOutcomeType;
  outcome_status: RecommendationOutcomeStatus;
  observed_value: number | null; // numeric(6,3)
  expected_value: number | null; // numeric(6,3)
  effectiveness_score: number;   // numeric(4,3) 0.0–1.0
  observed_at: string;           // timestamptz
  created_at: string;            // timestamptz
};

export const CONSTITUTIONAL_RECOMMENDATION_OUTCOME_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "recommendation_id",
  "application_id",
  "outcome_type",
  "outcome_status",
  "observed_value",
  "expected_value",
  "effectiveness_score",
  "observed_at",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRecommendationOutcomeRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_recommendation_feedback
// Source: 20260622000003_recommendation_effectiveness_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationFeedbackType = "positive" | "neutral" | "negative";

export type ConstitutionalRecommendationFeedbackRow = {
  id: string;                // uuid primary key
  workspace_id: string;      // uuid references workspaces
  recommendation_id: string; // uuid references constitutional_recommendations
  application_id: string;    // uuid references constitutional_recommendation_applications
  feedback_type: RecommendationFeedbackType;
  rating: number;            // integer 1–5
  comments: string | null;   // text
  submitted_by: string;      // uuid references auth.users
  created_at: string;        // timestamptz
};

export const CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "recommendation_id",
  "application_id",
  "feedback_type",
  "rating",
  "comments",
  "submitted_by",
  "created_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRecommendationFeedbackRow>;

// ─────────────────────────────────────────────────────────────────────────────
// constitutional_recommendation_effectiveness
// Source: 20260622000003_recommendation_effectiveness_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ConstitutionalRecommendationEffectivenessRow = {
  id: string;                   // uuid primary key
  workspace_id: string;         // uuid references workspaces
  recommendation_id: string;    // uuid references constitutional_recommendations
  applications_count: number;   // integer
  successful_count: number;     // integer
  failed_count: number;         // integer
  neutral_count: number;        // integer
  average_effectiveness: number; // numeric(4,3) 0.0–1.0
  confidence_adjustment: number; // numeric(4,3) -1.0–1.0
  last_calculated_at: string;   // timestamptz
};

export const CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "recommendation_id",
  "applications_count",
  "successful_count",
  "failed_count",
  "neutral_count",
  "average_effectiveness",
  "confidence_adjustment",
  "last_calculated_at",
] as const satisfies ReadonlyArray<keyof ConstitutionalRecommendationEffectivenessRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_signals
// Source: 20260704000000_governance_signal_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceSignalType =
  | "approval_delay"
  | "authority_gap"
  | "escalation_gap"
  | "decision_bottleneck"
  | "amendment_backlog"
  | "ratification_stall"
  | "risk_accumulation"
  | "recommendation_ignored"
  | "governance_violation"
  | "delivery_drift";

export type GovernanceSignalSeverity = "low" | "medium" | "high" | "critical";
export type GovernanceSignalStatus = "active" | "acknowledged" | "resolved" | "dismissed";

export type GovernanceSignalSource =
  | "constitution"
  | "decision"
  | "amendment"
  | "ratification"
  | "authority"
  | "delegation"
  | "recommendation"
  | "risk"
  | "project";

export type GovernanceSignalRow = {
  id: string;                     // uuid PK
  workspace_id: string;           // uuid references workspaces
  signal_type: GovernanceSignalType;     // text not null
  signal_source: GovernanceSignalSource; // text not null
  source_entity_type: string;     // text not null
  source_entity_id: string;       // uuid not null
  title: string;                  // text not null
  description: string;            // text not null
  severity: GovernanceSignalSeverity;    // text not null
  confidence_score: number;       // numeric(4,3) 0.0–1.0
  status: GovernanceSignalStatus; // text not null default 'active'
  detected_at: string;            // timestamptz
  acknowledged_at: string | null; // timestamptz
  acknowledged_by: string | null; // uuid
  resolved_at: string | null;     // timestamptz
  resolved_by: string | null;     // uuid
  dismissed_at: string | null;    // timestamptz
  dismissed_by: string | null;    // uuid
  dismissed_reason: string | null;// text
  created_at: string;             // timestamptz
  updated_at: string;             // timestamptz
};

export const GOVERNANCE_SIGNAL_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "signal_type",
  "signal_source",
  "source_entity_type",
  "source_entity_id",
  "title",
  "description",
  "severity",
  "confidence_score",
  "status",
  "detected_at",
  "acknowledged_at",
  "acknowledged_by",
  "resolved_at",
  "resolved_by",
  "dismissed_at",
  "dismissed_by",
  "dismissed_reason",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof GovernanceSignalRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_signal_evidence
// Source: 20260704000000_governance_signal_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceSignalEvidenceType =
  | "decision_observation"
  | "amendment_observation"
  | "authority_observation"
  | "ratification_observation"
  | "recommendation_observation"
  | "violation_observation"
  | "pattern_match"
  | "historical_data";

export type GovernanceSignalEvidenceRow = {
  id: string;                              // uuid PK
  workspace_id: string;                    // uuid references workspaces
  signal_id: string;                       // uuid references governance_signals
  evidence_type: GovernanceSignalEvidenceType; // text not null
  reference_entity_type: string;           // text not null
  reference_entity_id: string;             // uuid not null
  contribution_weight: number;             // numeric(4,3) 0.0–1.0
  created_at: string;                      // timestamptz
};

export const GOVERNANCE_SIGNAL_EVIDENCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "signal_id",
  "evidence_type",
  "reference_entity_type",
  "reference_entity_id",
  "contribution_weight",
  "created_at",
] as const satisfies ReadonlyArray<keyof GovernanceSignalEvidenceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_signal_recommendations
// Source: 20260704000000_governance_signal_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceSignalRecommendationRow = {
  id: string;               // uuid PK
  workspace_id: string;     // uuid references workspaces
  signal_id: string;        // uuid references governance_signals
  recommendation_id: string;// uuid references constitutional_recommendations
  confidence_score: number; // numeric(4,3) 0.0–1.0
  created_at: string;       // timestamptz
};

export const GOVERNANCE_SIGNAL_RECOMMENDATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "signal_id",
  "recommendation_id",
  "confidence_score",
  "created_at",
] as const satisfies ReadonlyArray<keyof GovernanceSignalRecommendationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_actions
// Source: 20260705000000_governance_action_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceActionType =
  | "create_escalation"
  | "request_ratification"
  | "request_approval"
  | "create_delegation"
  | "assign_authority"
  | "review_amendment"
  | "review_decision"
  | "review_risk"
  | "initiate_governance_review"
  | "close_signal"
  | "reassess_recommendation"
  | "other";

export type GovernanceActionPriority = "low" | "medium" | "high" | "critical";

export type GovernanceActionStatus =
  | "generated"
  | "reviewed"
  | "approved"
  | "rejected"
  | "expired"
  | "completed";

export type GovernanceActionRow = {
  id: string;                        // uuid PK
  workspace_id: string;              // uuid references workspaces
  signal_id: string;                 // uuid references governance_signals
  action_type: GovernanceActionType; // text not null
  action_priority: GovernanceActionPriority; // text not null
  action_status: GovernanceActionStatus;     // text not null default 'generated'
  title: string;                     // text not null
  description: string;               // text not null
  recommended_owner_type: string;    // text not null
  recommended_owner_id: string | null; // uuid
  recommended_due_date: string;      // timestamptz not null
  justification: string;             // text not null
  confidence_score: number;          // numeric(4,3) 0.0–1.0
  created_at: string;                // timestamptz
  updated_at: string;                // timestamptz
  completed_at: string | null;       // timestamptz
  expired_at: string | null;         // timestamptz
};

export const GOVERNANCE_ACTION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "signal_id",
  "action_type",
  "action_priority",
  "action_status",
  "title",
  "description",
  "recommended_owner_type",
  "recommended_owner_id",
  "recommended_due_date",
  "justification",
  "confidence_score",
  "created_at",
  "updated_at",
  "completed_at",
  "expired_at",
] as const satisfies ReadonlyArray<keyof GovernanceActionRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_action_evidence
// Source: 20260705000000_governance_action_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceActionEvidenceRow = {
  id: string;                     // uuid PK
  workspace_id: string;           // uuid references workspaces
  action_id: string;              // uuid references governance_actions
  signal_id: string | null;       // uuid references governance_signals
  recommendation_id: string | null; // uuid
  learning_pattern_id: string | null; // uuid
  contribution_weight: number;    // numeric(4,3) 0.0–1.0
  created_at: string;             // timestamptz
};

export const GOVERNANCE_ACTION_EVIDENCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "action_id",
  "signal_id",
  "recommendation_id",
  "learning_pattern_id",
  "contribution_weight",
  "created_at",
] as const satisfies ReadonlyArray<keyof GovernanceActionEvidenceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_action_assignments
// Source: 20260705000000_governance_action_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceActionAssignmentStatus =
  | "assigned"
  | "accepted"
  | "completed"
  | "declined";

export type GovernanceActionAssignmentRow = {
  id: string;              // uuid PK
  workspace_id: string;    // uuid references workspaces
  action_id: string;       // uuid references governance_actions
  assigned_to: string;     // uuid
  assignment_status: GovernanceActionAssignmentStatus; // text not null
  assigned_at: string;     // timestamptz
  accepted_at: string | null; // timestamptz
  completed_at: string | null; // timestamptz
};

export const GOVERNANCE_ACTION_ASSIGNMENT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "action_id",
  "assigned_to",
  "assignment_status",
  "assigned_at",
  "accepted_at",
  "completed_at",
] as const satisfies ReadonlyArray<keyof GovernanceActionAssignmentRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_commitments
// Source: 20260706000000_governance_commitment_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceCommitmentStatus =
  | "pending_acceptance"
  | "accepted"
  | "rejected"
  | "active"
  | "completed"
  | "breached"
  | "cancelled"
  | "delegated"
  | "expired";

export type GovernanceCommitmentPriority = "low" | "medium" | "high" | "critical";

export type GovernanceCommitmentOutcome = "successful" | "partial" | "failed" | "unknown";

export type GovernanceCommitmentRow = {
  id: string;                                      // uuid PK
  workspace_id: string;                            // uuid references workspaces
  action_id: string;                               // uuid references governance_actions
  commitment_title: string;                        // text not null
  commitment_description: string;                  // text not null
  owner_id: string;                                // uuid not null
  owner_type: string;                              // text not null
  priority: GovernanceCommitmentPriority;          // text not null
  status: GovernanceCommitmentStatus;              // text not null default 'pending_acceptance'
  due_date: string;                                // timestamptz not null
  accepted_at: string | null;                      // timestamptz
  started_at: string | null;                       // timestamptz
  completed_at: string | null;                     // timestamptz
  cancelled_at: string | null;                     // timestamptz
  breached_at: string | null;                      // timestamptz
  expired_at: string | null;                       // timestamptz
  outcome: GovernanceCommitmentOutcome | null;     // text
  created_at: string;                              // timestamptz
  updated_at: string;                              // timestamptz
};

export const GOVERNANCE_COMMITMENT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "action_id",
  "commitment_title",
  "commitment_description",
  "owner_id",
  "owner_type",
  "priority",
  "status",
  "due_date",
  "accepted_at",
  "started_at",
  "completed_at",
  "cancelled_at",
  "breached_at",
  "expired_at",
  "outcome",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof GovernanceCommitmentRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_commitment_history
// Source: 20260706000000_governance_commitment_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceCommitmentHistoryRow = {
  id: string;              // uuid PK
  workspace_id: string;    // uuid references workspaces
  commitment_id: string;   // uuid references governance_commitments
  previous_status: string; // text not null
  new_status: string;      // text not null
  changed_by: string;      // uuid not null
  reason: string | null;   // text
  created_at: string;      // timestamptz
};

export const GOVERNANCE_COMMITMENT_HISTORY_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "commitment_id",
  "previous_status",
  "new_status",
  "changed_by",
  "reason",
  "created_at",
] as const satisfies ReadonlyArray<keyof GovernanceCommitmentHistoryRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_commitment_delegations
// Source: 20260706000000_governance_commitment_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceCommitmentDelegationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";

export type GovernanceCommitmentDelegationRow = {
  id: string;              // uuid PK
  workspace_id: string;    // uuid references workspaces
  commitment_id: string;   // uuid references governance_commitments
  delegated_by: string;    // uuid not null
  delegated_to: string;    // uuid not null
  reason: string;          // text not null
  delegated_at: string;    // timestamptz
  accepted_at: string | null; // timestamptz
  status: GovernanceCommitmentDelegationStatus; // text not null
  created_at: string;      // timestamptz
};

export const GOVERNANCE_COMMITMENT_DELEGATION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "commitment_id",
  "delegated_by",
  "delegated_to",
  "reason",
  "delegated_at",
  "accepted_at",
  "status",
  "created_at",
] as const satisfies ReadonlyArray<keyof GovernanceCommitmentDelegationRow>;

// ─────────────────────────────────────────────────────────────────────────────
// governance_commitment_evidence
// Source: 20260706000000_governance_commitment_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type GovernanceCommitmentEvidenceRow = {
  id: string;                       // uuid PK
  workspace_id: string;             // uuid references workspaces
  commitment_id: string;            // uuid references governance_commitments
  artifact_id: string | null;       // uuid
  memory_record_id: string | null;  // uuid
  description: string;              // text not null
  created_at: string;               // timestamptz
};

export const GOVERNANCE_COMMITMENT_EVIDENCE_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "commitment_id",
  "artifact_id",
  "memory_record_id",
  "description",
  "created_at",
] as const satisfies ReadonlyArray<keyof GovernanceCommitmentEvidenceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_projections
// Source: 20260707000000_execution_projection_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionProjectionStatus =
  | "generated"
  | "validated"
  | "approved"
  | "rejected"
  | "archived";

export type ExecutionProjectionRisk = "low" | "medium" | "high" | "critical";

export type ExecutionProjectionRow = {
  id: string;                                   // uuid PK
  workspace_id: string;                         // uuid references workspaces
  commitment_id: string;                        // uuid references governance_commitments
  projection_title: string;                     // text not null
  projection_description: string;               // text not null
  status: ExecutionProjectionStatus;            // text not null default 'generated'
  estimated_effort_hours: number;               // integer not null default 0
  estimated_duration_days: number;              // integer not null default 0
  projected_risk: ExecutionProjectionRisk;      // text not null default 'low'
  confidence_score: number;                     // numeric(4,3) not null default 0.0
  generated_at: string;                         // timestamptz not null
  validated_at: string | null;                  // timestamptz
  approved_at: string | null;                   // timestamptz
  archived_at: string | null;                   // timestamptz
  created_at: string;                           // timestamptz
  updated_at: string;                           // timestamptz
};

export const EXECUTION_PROJECTION_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "commitment_id",
  "projection_title",
  "projection_description",
  "status",
  "estimated_effort_hours",
  "estimated_duration_days",
  "projected_risk",
  "confidence_score",
  "generated_at",
  "validated_at",
  "approved_at",
  "archived_at",
  "created_at",
  "updated_at",
] as const satisfies ReadonlyArray<keyof ExecutionProjectionRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_projection_tasks
// Source: 20260707000000_execution_projection_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionProjectionTaskRow = {
  id: string;              // uuid PK
  workspace_id: string;    // uuid references workspaces
  projection_id: string;   // uuid references execution_projections
  task_name: string;       // text not null
  task_description: string; // text not null
  estimated_hours: number; // integer not null default 0
  sequence_order: number;  // integer not null default 0
  owner_type: string;      // text not null
  created_at: string;      // timestamptz
};

export const EXECUTION_PROJECTION_TASK_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "projection_id",
  "task_name",
  "task_description",
  "estimated_hours",
  "sequence_order",
  "owner_type",
  "created_at",
] as const satisfies ReadonlyArray<keyof ExecutionProjectionTaskRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_projection_dependencies
// Source: 20260707000000_execution_projection_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionProjectionDependencyType =
  | "decision"
  | "authority"
  | "ratification"
  | "amendment"
  | "resource";

export type ExecutionProjectionDependencyCriticality = "low" | "medium" | "high" | "critical";

export type ExecutionProjectionDependencyRow = {
  id: string;                                                   // uuid PK
  workspace_id: string;                                         // uuid references workspaces
  projection_id: string;                                        // uuid references execution_projections
  dependency_type: ExecutionProjectionDependencyType;           // text not null
  dependency_reference: string;                                 // text not null
  criticality: ExecutionProjectionDependencyCriticality;        // text not null default 'medium'
  created_at: string;                                           // timestamptz
};

export const EXECUTION_PROJECTION_DEPENDENCY_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "projection_id",
  "dependency_type",
  "dependency_reference",
  "criticality",
  "created_at",
] as const satisfies ReadonlyArray<keyof ExecutionProjectionDependencyRow>;

// ─────────────────────────────────────────────────────────────────────────────
// execution_projection_participants
// Source: 20260707000000_execution_projection_engine.sql
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionProjectionParticipantRow = {
  id: string;                    // uuid PK
  workspace_id: string;          // uuid references workspaces
  projection_id: string;         // uuid references execution_projections
  participant_type: string;      // text not null
  participant_reference: string; // text not null
  responsibility: string;        // text not null
  created_at: string;            // timestamptz
};

export const EXECUTION_PROJECTION_PARTICIPANT_SELECTABLE_COLUMNS = [
  "id",
  "workspace_id",
  "projection_id",
  "participant_type",
  "participant_reference",
  "responsibility",
  "created_at",
] as const satisfies ReadonlyArray<keyof ExecutionProjectionParticipantRow>;

export const DATABASE_CONTRACT_VERSION ="2026-06-18-platform-events-execution-tasks-decision-effectiveness-pattern-extraction-foundation-personal-pm-patterns-personal-pm-effectiveness-personal-pattern-extraction-foundation-constitutional-brief-executive-brief-governance-brief-operational-brief-portfolio-brief-constitutional-dashboard-constitutional-workspace-execution-augmentation-constitutional-intelligence-context-engine-constitutional-intelligence-intelligence-bridge-constitutional-intelligence-intelligence-bridge-2026-06-24-project-constitution-amendment-governance-2026-06-25-project-constitutional-decision-governance-2026-06-26-constitutional-ratification-framework-2026-06-27-authority-registry-governance-2026-06-19-constitutional-digest-engine-2026-06-28-programs-2026-06-29-program-hierarchy-2026-06-21-program-roadmap-sources-2026-06-30-program-roadmap-parse-results-2026-07-02-program-execution-board-2026-07-03-program-card-context-projection-2026-06-22-constitutional-learning-engine-2026-06-22-sovereign-recommendation-engine-2026-06-22-recommendation-effectiveness-engine-2026-07-04-governance-signal-engine-2026-07-05-governance-action-engine-2026-07-06-governance-commitment-engine-2026-07-07-execution-projection-engine" as const;
