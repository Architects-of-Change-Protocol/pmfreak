import type { WorkspaceRole } from "@/lib/workspace-access";

/**
 * Workspace activation — evidence-derived onboarding progress.
 *
 * Every value in this domain is computed from real workspace data (projects,
 * tasks, RAID items, messages, invitations, recommendations). There is no
 * manual "mark as complete" path and no persisted `onboardingComplete` flag:
 * the only persisted state is per-user display preference (collapse/dismiss/
 * skipped optional steps) in `workspace_onboarding_preferences`.
 */

export type WorkspaceActivationStage =
  | "workspace_created"
  | "project_created"
  | "execution_started"
  | "signals_available"
  | "insights_available";

export type WorkspaceActivationStepId =
  | "workspace_created"
  | "pmo_created"
  | "member_invited"
  | "project_created"
  | "task_created"
  | "milestone_created"
  | "raid_registered"
  | "conversation_started"
  | "execution_signal_generated"
  | "insights_reviewed";

export const WORKSPACE_ACTIVATION_STEP_IDS: readonly WorkspaceActivationStepId[] = [
  "workspace_created",
  "pmo_created",
  "member_invited",
  "project_created",
  "task_created",
  "milestone_created",
  "raid_registered",
  "conversation_started",
  "execution_signal_generated",
  "insights_reviewed",
];

export type WorkspaceActivationPhase = "foundation" | "execution" | "operational_value";

/** Derived from existing workspace concepts (owner_type, memberships, invites) —
 *  never a new persisted mode flag. */
export type WorkspaceActivationMode = "individual" | "team";

export type WorkspaceActivationStepStatus =
  | "completed"
  | "available"
  | "blocked"
  | "not_applicable";

/** Display tier. `required: true` ⇔ tier "essential". */
export type WorkspaceActivationStepTier = "essential" | "recommended" | "optional";

export type WorkspaceActivationStep = {
  id: WorkspaceActivationStepId;
  phase: WorkspaceActivationPhase;
  status: WorkspaceActivationStepStatus;
  required: boolean;
  tier: WorkspaceActivationStepTier;
  /** Where the step can actually be completed. Null when the step has no
   *  direct user action (it completes automatically from real activity). */
  route: string | null;
  blockedBy: WorkspaceActivationStepId[];
  /** Whether the current member's real workspace role may perform the CTA.
   *  False for e.g. a viewer on "Create your first project". Presentation
   *  only — every write path re-authorizes server-side. */
  actionAllowed: boolean;
  /** Extra evidence nuance, e.g. an invitation that exists but is still
   *  pending acceptance. */
  note: "invite_pending" | null;
};

/**
 * Raw evidence collected from the database for one workspace. Every field is
 * a fact about real rows — nothing here is simulated or defaulted to look
 * populated.
 */
export type WorkspaceActivationEvidence = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  ownerType: string | null;
  /** Number of memberships observed, capped at 2 (we only need "more than one"). */
  memberCount: number;
  pendingInviteExists: boolean;
  pmoExists: boolean;
  /** Non-archived projects only. */
  projectExists: boolean;
  taskExists: boolean;
  milestoneExists: boolean;
  raidItemExists: boolean;
  governanceSignalExists: boolean;
  recommendedActionExists: boolean;
  /** A real message authored by a user (role='user'), not merely an opened screen. */
  userMessageExists: boolean;
  /** UX interaction event persisted in workspace_onboarding_preferences. */
  insightsFirstViewedAt: string | null;
};

export type WorkspaceActivationResult = {
  stage: WorkspaceActivationStage;
  mode: WorkspaceActivationMode;
  /** Workspace + project + real work item exist. */
  operationallyStarted: boolean;
  /** Every applicable essential step is completed. */
  workspaceReady: boolean;
  completedEssentialSteps: number;
  totalEssentialSteps: number;
  completedRecommendedSteps: number;
  totalRecommendedSteps: number;
  steps: WorkspaceActivationStep[];
};

/** Current shape/version of the guided onboarding checklist. Bump when the
 *  step catalog changes incompatibly so clients can re-show the panel. */
export const WORKSPACE_ONBOARDING_VERSION = 1;

/** Per-user, per-workspace display preferences. Never a source of truth for
 *  progress — progress is always derived from evidence. */
export type WorkspaceOnboardingPreferences = {
  workspaceId: string;
  userId: string;
  onboardingVersion: number;
  collapsed: boolean;
  dismissedAt: string | null;
  skippedStepIds: WorkspaceActivationStepId[];
  insightsFirstViewedAt: string | null;
};

export const DEFAULT_WORKSPACE_ONBOARDING_PREFERENCES = (
  workspaceId: string,
  userId: string,
): WorkspaceOnboardingPreferences => ({
  workspaceId,
  userId,
  onboardingVersion: WORKSPACE_ONBOARDING_VERSION,
  collapsed: false,
  dismissedAt: null,
  skippedStepIds: [],
  insightsFirstViewedAt: null,
});
