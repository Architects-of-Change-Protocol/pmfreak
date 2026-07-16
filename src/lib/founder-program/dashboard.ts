/**
 * Founder Circle Program — operations dashboard aggregation
 * (docs/founder-program/11).
 *
 * Every number here is derived from real rows in founder_* tables. Metrics
 * with no evidence yet are reported as `null` with an explicit
 * `available: false` marker — the UI renders honest empty states, never
 * demo/fallback values. Retention windows are only computed over
 * participants for whom that much real time has actually elapsed.
 */
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { type FounderProgramSettings } from "@/lib/founder-program/config";
import {
  FOUNDER_ACCESS_STATES,
  FOUNDER_APPROVED_CAPACITY_STATES,
  FOUNDER_LIFECYCLE_STATES,
  FOUNDER_ONBOARDING_CHECKPOINTS,
} from "@/lib/founder-program/lifecycle";

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

export type Metric<T> = { readonly available: true; readonly value: T } | { readonly available: false; readonly value: null; readonly reason: string };

const metric = <T>(value: T): Metric<T> => ({ available: true, value });
const unavailable = <T>(reason: string): Metric<T> => ({ available: false, value: null, reason });

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const HOUR = 1000 * 60 * 60;

export type FounderProgramDashboard = ReturnType<typeof buildDashboardShape> extends Promise<infer T> ? T : never;

async function buildDashboardShape(client: SupabaseLike, settings: FounderProgramSettings) {
  const [{ data: participants }, { data: invitations }, { data: transitions }, { data: checkpoints }, { data: feedback }, { data: sessions }, { data: decisions }, { data: returnEvents }] =
    await Promise.all([
      client.from("founder_participants").select("id, lifecycle_state, archetype, cohort, activated_at, agreement_version_accepted, updated_at, created_at"),
      client.from("founder_invitations").select("id, status, created_at"),
      client.from("founder_membership_transitions").select("participant_id, from_state, to_state, actor_type, created_at"),
      client.from("founder_onboarding_checkpoints").select("participant_id, checkpoint, reached_at"),
      client.from("founder_feedback").select("id, feedback_type, status, severity, created_at"),
      client.from("founder_discovery_sessions").select("id, session_type, status, willingness_to_pay, scheduled_for, completed_on"),
      client.from("founder_program_decisions").select("id, decision, decided_on, next_review_on, created_at").order("created_at", { ascending: false }),
      client.from("founder_program_events").select("participant_id, event_name, occurred_at").eq("event_name", "founder_return_visit"),
    ]);

  const participantRows = participants ?? [];
  const invitationRows = invitations ?? [];
  const transitionRows = transitions ?? [];
  const checkpointRows = checkpoints ?? [];
  const feedbackRows = feedback ?? [];
  const sessionRows = sessions ?? [];
  const decisionRows = decisions ?? [];
  const returnVisitRows = returnEvents ?? [];

  const stateCounts: Record<string, number> = Object.fromEntries(FOUNDER_LIFECYCLE_STATES.map((s) => [s, 0]));
  for (const p of participantRows) stateCounts[String(p.lifecycle_state)] = (stateCounts[String(p.lifecycle_state)] ?? 0) + 1;

  const everReached = (state: string) =>
    new Set(transitionRows.filter((t) => t.to_state === state).map((t) => t.participant_id)).size;

  const capacity = {
    approvedUsed: participantRows.filter((p) => (FOUNDER_APPROVED_CAPACITY_STATES as readonly string[]).includes(String(p.lifecycle_state))).length,
    approvedLimit: settings.maxApprovedParticipants,
    activeUsed: participantRows.filter((p) => (FOUNDER_ACCESS_STATES as readonly string[]).includes(String(p.lifecycle_state))).length,
    activeLimit: settings.maxActiveParticipants,
  };

  const invitationCounts = {
    total: invitationRows.length,
    pending: invitationRows.filter((i) => i.status === "pending").length,
    viewed: invitationRows.filter((i) => i.status === "viewed").length,
    applied: invitationRows.filter((i) => i.status === "applied").length,
    expired: invitationRows.filter((i) => i.status === "expired").length,
    revoked: invitationRows.filter((i) => i.status === "revoked").length,
  };

  const funnel = {
    invited: everReached("invited"),
    viewed: everReached("invite_viewed"),
    applied: everReached("applied"),
    approved: everReached("approved"),
    agreementAccepted: everReached("agreement_accepted"),
    activated: everReached("onboarding_active"),
    fullyActivated: everReached("activated"),
  };

  // Median durations between lifecycle milestones, from the audit trail.
  const firstTransitionAt = (participantId: unknown, state: string): number | null => {
    const row = transitionRows.find((t) => t.participant_id === participantId && t.to_state === state);
    return row ? new Date(String(row.created_at)).getTime() : null;
  };
  const durations = (fromState: string, toState: string): number[] =>
    participantRows
      .map((p) => {
        const start = firstTransitionAt(p.id, fromState);
        const end = firstTransitionAt(p.id, toState);
        return start !== null && end !== null && end >= start ? (end - start) / HOUR : null;
      })
      .filter((v): v is number => v !== null);

  const inviteToApply = median(durations("invited", "applied"));
  const approveToAgreement = median(durations("approved", "agreement_accepted"));
  const agreementToActivation = median(durations("agreement_accepted", "onboarding_active"));

  const checkpointFunnel = FOUNDER_ONBOARDING_CHECKPOINTS.map((checkpoint) => ({
    checkpoint,
    participants: new Set(checkpointRows.filter((c) => c.checkpoint === checkpoint).map((c) => c.participant_id)).size,
  }));

  const feedbackByType: Record<string, number> = {};
  const feedbackByStatus: Record<string, number> = {};
  for (const f of feedbackRows) {
    feedbackByType[String(f.feedback_type)] = (feedbackByType[String(f.feedback_type)] ?? 0) + 1;
    feedbackByStatus[String(f.status)] = (feedbackByStatus[String(f.status)] ?? 0) + 1;
  }

  // Retention windows: computed ONLY over participants activated at least
  // that many days ago (no fabricated cohorts before time has passed).
  const now = Date.now();
  const retention = (days: number): Metric<{ eligible: number; returned: number }> => {
    const eligible = participantRows.filter((p) => p.activated_at && now - new Date(String(p.activated_at)).getTime() >= days * 24 * HOUR);
    if (eligible.length === 0) return unavailable(`no participant activated ≥ ${days} days ago yet`);
    const returned = eligible.filter((p) =>
      returnVisitRows.some(
        (e) => e.participant_id === p.id && new Date(String(e.occurred_at)).getTime() - new Date(String(p.activated_at)).getTime() >= days * 24 * HOUR,
      ),
    ).length;
    return metric({ eligible: eligible.length, returned });
  };

  const needsAttention = participantRows.filter((p) => {
    if (!["agreement_pending", "onboarding_pending"].includes(String(p.lifecycle_state))) return false;
    const updated = new Date(String(p.updated_at ?? p.created_at)).getTime();
    return now - updated > 7 * 24 * HOUR;
  }).length;

  const agreementRenewalRequired = participantRows.filter(
    (p) =>
      (FOUNDER_ACCESS_STATES as readonly string[]).includes(String(p.lifecycle_state)) &&
      p.agreement_version_accepted !== settings.requiredAgreementVersion,
  ).length;

  const programState = !settings.programEnabled
    ? "disabled"
    : capacity.activeUsed > 0
      ? "onboarding"
      : invitationCounts.pending + invitationCounts.viewed > 0
        ? "accepting_invites"
        : "idle";

  return {
    generatedAt: new Date().toISOString(),
    programState,
    capacity,
    invitations: invitationCounts,
    states: stateCounts,
    funnel,
    timings: {
      inviteToApplicationHoursMedian: inviteToApply !== null ? metric(inviteToApply) : unavailable<number>("no participant has completed invitation → application yet"),
      approvalToAgreementHoursMedian: approveToAgreement !== null ? metric(approveToAgreement) : unavailable<number>("no participant has completed approval → agreement yet"),
      agreementToActivationHoursMedian: agreementToActivation !== null ? metric(agreementToActivation) : unavailable<number>("no participant has completed agreement → activation yet"),
    },
    onboarding: {
      checkpointFunnel,
      needsAttention,
      agreementRenewalRequired,
    },
    feedback: {
      total: feedbackRows.length,
      byType: feedbackByType,
      byStatus: feedbackByStatus,
    },
    discovery: {
      total: sessionRows.length,
      completed: sessionRows.filter((s) => s.status === "completed").length,
    },
    retention: {
      day1: retention(1),
      day7: retention(7),
      day14: retention(14),
    },
    decisions: decisionRows.slice(0, 5),
    counts: {
      participants: participantRows.length,
      waitlisted: stateCounts.waitlisted ?? 0,
      paused: stateCounts.paused ?? 0,
      revoked: stateCounts.revoked ?? 0,
      withdrawn: stateCounts.withdrawn ?? 0,
    },
  };
}

export async function computeFounderProgramDashboard(
  settings: FounderProgramSettings,
  deps: { client?: SupabaseLike; operatorUserId?: string } = {},
) {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "compute_dashboard", actorUserId: deps.operatorUserId ?? null });
  return buildDashboardShape(client, settings);
}
