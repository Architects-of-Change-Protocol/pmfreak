/**
 * Founder Circle Program — canonical lifecycle state machine.
 *
 * This module is the single allowlist of participant states and transitions
 * (docs/founder-program/03-lifecycle-state-machine.md). No other file may
 * hardcode transition pairs; everything that changes a participant's state
 * goes through applyFounderProgramTransition (transitions.ts), which
 * consults this policy first and then applies the change atomically via the
 * founder_program_transition SQL function.
 *
 * Pure data + pure functions — no I/O — so the whole policy is unit-testable.
 */

export const FOUNDER_LIFECYCLE_STATES = [
  "nominated",
  "invited",
  "invite_viewed",
  "applied",
  "under_review",
  "approved",
  "rejected",
  "waitlisted",
  "agreement_pending",
  "agreement_accepted",
  "onboarding_pending",
  "onboarding_active",
  "activated",
  "feedback_active",
  "paused",
  "completed",
  "withdrawn",
  "revoked",
] as const;

export type FounderLifecycleState = (typeof FOUNDER_LIFECYCLE_STATES)[number];

export type FounderTransitionActor = "participant" | "operator" | "system";

export const FOUNDER_TERMINAL_STATES: readonly FounderLifecycleState[] = [
  "rejected",
  "completed",
  "withdrawn",
  "revoked",
] as const;

/** States in which the participant has Founder Circle program access. */
export const FOUNDER_ACCESS_STATES: readonly FounderLifecycleState[] = [
  "onboarding_active",
  "activated",
  "feedback_active",
] as const;

/**
 * States counted against `max_approved_participants` (approved-or-later,
 * non-terminal). Must stay in sync with the SQL function's 'approved' scope.
 */
export const FOUNDER_APPROVED_CAPACITY_STATES: readonly FounderLifecycleState[] = [
  "approved",
  "agreement_pending",
  "agreement_accepted",
  "onboarding_pending",
  "onboarding_active",
  "activated",
  "feedback_active",
  "paused",
] as const;

export const FOUNDER_ARCHETYPES = [
  "independent_pm",
  "pmo_practitioner",
  "agile_lead",
  "program_manager",
  "consultant",
  "operations_leader",
  "founder_operator",
  "other",
] as const;

export type FounderArchetype = (typeof FOUNDER_ARCHETYPES)[number];

export const FOUNDER_ONBOARDING_CHECKPOINTS = [
  "invite_opened",
  "application_submitted",
  "approved",
  "agreement_accepted",
  "first_login",
  "workspace_ready",
  "first_project_created",
  "first_data_entered",
  "first_command_center_visit",
  "first_core_capability_used",
  "first_feedback_submitted",
  "first_followup_session_completed",
  "activation_completed",
] as const;

export type FounderOnboardingCheckpoint = (typeof FOUNDER_ONBOARDING_CHECKPOINTS)[number];

/**
 * Canonical activation criterion (docs/founder-program/03, "activated").
 * Page views alone never count — every entry here is a concrete action.
 */
export const FOUNDER_ACTIVATION_REQUIRED_CHECKPOINTS: readonly FounderOnboardingCheckpoint[] = [
  "agreement_accepted",
  "first_login",
  "workspace_ready",
  "first_project_created",
  "first_core_capability_used",
] as const;

export type FounderTransitionRule = {
  readonly from: readonly FounderLifecycleState[];
  readonly to: FounderLifecycleState;
  readonly actors: readonly FounderTransitionActor[];
  readonly requiresReason: boolean;
  /** Capacity scope enforced atomically in the DB function, if any. */
  readonly capacityScope?: "approved" | "active";
  readonly description: string;
};

/**
 * The transition allowlist. Anything absent from this table is a forbidden
 * transition. Every applied transition creates an audit row (DB function)
 * and a `founder_program_transition` security event (transitions.ts).
 */
export const FOUNDER_TRANSITION_RULES: readonly FounderTransitionRule[] = [
  { from: ["nominated"], to: "invited", actors: ["operator"], requiresReason: false, description: "Invitation issued/sent" },
  { from: ["nominated"], to: "revoked", actors: ["operator"], requiresReason: true, description: "Nomination cancelled" },
  { from: ["invited"], to: "invite_viewed", actors: ["system"], requiresReason: false, description: "Invitation first opened" },
  { from: ["invited", "invite_viewed"], to: "applied", actors: ["participant"], requiresReason: false, description: "Application submitted" },
  { from: ["invited", "invite_viewed"], to: "revoked", actors: ["operator", "system"], requiresReason: true, description: "Invitation revoked or expired" },
  { from: ["applied"], to: "under_review", actors: ["operator"], requiresReason: false, description: "Review started" },
  { from: ["applied", "under_review", "waitlisted"], to: "approved", actors: ["operator"], requiresReason: false, capacityScope: "approved", description: "Admission approved (capacity-enforced)" },
  { from: ["applied", "under_review", "waitlisted"], to: "rejected", actors: ["operator"], requiresReason: true, description: "Admission rejected" },
  { from: ["applied", "under_review"], to: "waitlisted", actors: ["operator", "system"], requiresReason: true, description: "Waitlisted (operator decision or capacity)" },
  { from: ["waitlisted"], to: "under_review", actors: ["operator"], requiresReason: false, description: "Waitlist re-opened for review" },
  { from: ["approved"], to: "agreement_pending", actors: ["system"], requiresReason: false, description: "Agreement step required (automatic after approval)" },
  { from: ["agreement_pending"], to: "agreement_accepted", actors: ["participant"], requiresReason: false, description: "Current agreement version accepted" },
  { from: ["agreement_accepted"], to: "onboarding_pending", actors: ["system"], requiresReason: false, description: "Ready for activation (automatic)" },
  { from: ["agreement_accepted", "onboarding_pending"], to: "agreement_pending", actors: ["system"], requiresReason: true, description: "Required agreement version changed" },
  { from: ["onboarding_pending"], to: "onboarding_active", actors: ["operator"], requiresReason: false, capacityScope: "active", description: "Controlled activation (agreement + capacity verified)" },
  { from: ["onboarding_active"], to: "activated", actors: ["system"], requiresReason: false, description: "Canonical activation criteria met" },
  { from: ["activated"], to: "feedback_active", actors: ["system"], requiresReason: false, description: "First structured feedback submitted" },
  { from: ["onboarding_active", "activated", "feedback_active"], to: "paused", actors: ["operator"], requiresReason: true, description: "Participation paused (no access while paused)" },
  { from: ["paused"], to: "onboarding_active", actors: ["operator"], requiresReason: false, capacityScope: "active", description: "Resumed from pause (active capacity re-checked)" },
  { from: ["onboarding_active", "activated", "feedback_active"], to: "completed", actors: ["operator"], requiresReason: false, description: "Participation concluded normally" },
  {
    from: ["agreement_pending", "agreement_accepted", "onboarding_pending", "onboarding_active", "activated", "feedback_active", "paused"],
    to: "revoked",
    actors: ["operator"],
    requiresReason: true,
    description: "Program access revoked",
  },
  {
    from: ["applied", "under_review", "approved", "waitlisted", "agreement_pending", "agreement_accepted", "onboarding_pending", "onboarding_active", "activated", "feedback_active", "paused"],
    to: "withdrawn",
    actors: ["participant"],
    requiresReason: false,
    description: "Participant withdrew voluntarily",
  },
] as const;

export type FounderTransitionCheck =
  | { readonly allowed: true; readonly rule: FounderTransitionRule }
  | { readonly allowed: false; readonly reason: "unknown_state" | "terminal_state" | "invalid_transition" | "actor_not_allowed" | "reason_required" };

export function isFounderLifecycleState(value: unknown): value is FounderLifecycleState {
  return typeof value === "string" && (FOUNDER_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export function isFounderArchetype(value: unknown): value is FounderArchetype {
  return typeof value === "string" && (FOUNDER_ARCHETYPES as readonly string[]).includes(value);
}

export function isFounderOnboardingCheckpoint(value: unknown): value is FounderOnboardingCheckpoint {
  return typeof value === "string" && (FOUNDER_ONBOARDING_CHECKPOINTS as readonly string[]).includes(value);
}

export function isTerminalFounderState(state: FounderLifecycleState): boolean {
  return FOUNDER_TERMINAL_STATES.includes(state);
}

export function grantsProgramAccess(state: FounderLifecycleState): boolean {
  return FOUNDER_ACCESS_STATES.includes(state);
}

export function checkFounderTransition(input: {
  from: unknown;
  to: unknown;
  actor: FounderTransitionActor;
  reason?: string | null;
}): FounderTransitionCheck {
  if (!isFounderLifecycleState(input.from) || !isFounderLifecycleState(input.to)) {
    return { allowed: false, reason: "unknown_state" };
  }
  if (isTerminalFounderState(input.from)) {
    return { allowed: false, reason: "terminal_state" };
  }
  const rule = FOUNDER_TRANSITION_RULES.find((candidate) => candidate.to === input.to && candidate.from.includes(input.from as FounderLifecycleState));
  if (!rule) {
    return { allowed: false, reason: "invalid_transition" };
  }
  if (!rule.actors.includes(input.actor)) {
    return { allowed: false, reason: "actor_not_allowed" };
  }
  if (rule.requiresReason && !(typeof input.reason === "string" && input.reason.trim().length > 0)) {
    return { allowed: false, reason: "reason_required" };
  }
  return { allowed: true, rule };
}
