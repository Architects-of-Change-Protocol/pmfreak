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
// Contract version — bump when any row type changes.
// ─────────────────────────────────────────────────────────────────────────────

export const DATABASE_CONTRACT_VERSION = "2026-06-02-raid-v1" as const;
