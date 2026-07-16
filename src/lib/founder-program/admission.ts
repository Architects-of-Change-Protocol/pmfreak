/**
 * Founder Circle Program — operator review, agreement gating, and controlled
 * activation (docs/founder-program/05, 06, 07).
 *
 * Approval is human-only and capacity-enforced in the database. Activation
 * is a separate, idempotent operator step that independently verifies:
 * approved lineage (state onboarding_pending), CURRENT agreement acceptance
 * (pilot_agreement_acceptances is the single source of truth), and active
 * capacity — then associates the participant's own canonical workspace.
 * Activation grants ONLY the curated pilot surface: participants remain
 * non-founder accounts on the free plan (the existing default profile);
 * nothing here can mint operator, service-role, or workspace-admin rights.
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { type FounderProgramSettings } from "@/lib/founder-program/config";
import { grantsProgramAccess, type FounderLifecycleState } from "@/lib/founder-program/lifecycle";
import { applyFounderProgramTransition, type FounderTransitionFailureCode } from "@/lib/founder-program/transitions";

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

export type FounderReviewDecision = "start_review" | "approve" | "reject" | "waitlist";

export type FounderAdmissionResult =
  | { readonly ok: true; readonly state: FounderLifecycleState }
  | { readonly ok: false; readonly code: FounderTransitionFailureCode | "participant_not_found" };

async function getParticipant(client: SupabaseLike, participantId: string) {
  const { data } = await client
    .from("founder_participants")
    .select("id, user_id, email, lifecycle_state, workspace_id, agreement_version_accepted, cohort")
    .eq("id", participantId)
    .maybeSingle();
  return data as
    | { id: string; user_id: string | null; email: string; lifecycle_state: FounderLifecycleState; workspace_id: string | null; agreement_version_accepted: string | null; cohort: string | null }
    | null;
}

export async function reviewFounderParticipant(
  input: {
    participantId: string;
    operatorUserId: string;
    decision: FounderReviewDecision;
    reason?: string | null;
    capacityOverride?: boolean;
  },
  deps: { client?: SupabaseLike } = {},
): Promise<FounderAdmissionResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "review_participant", actorUserId: input.operatorUserId });
  const participant = await getParticipant(client, input.participantId);
  if (!participant) return { ok: false, code: "participant_not_found" };

  const target: Record<FounderReviewDecision, FounderLifecycleState> = {
    start_review: "under_review",
    approve: "approved",
    reject: "rejected",
    waitlist: "waitlisted",
  };
  const to = target[input.decision];

  const transition = await applyFounderProgramTransition(
    {
      participantId: participant.id,
      from: participant.lifecycle_state,
      to,
      actor: "operator",
      actorUserId: input.operatorUserId,
      reason: input.reason ?? null,
      // Only an approve may ever override capacity, and only explicitly.
      capacityOverride: input.decision === "approve" && input.capacityOverride === true,
    },
    { client },
  );
  if (!transition.ok) return { ok: false, code: transition.code };

  if (input.decision === "approve") {
    // Automatic system step: approval immediately requires the agreement.
    const followUp = await applyFounderProgramTransition(
      { participantId: participant.id, from: "approved", to: "agreement_pending", actor: "system" },
      { client },
    );
    if (participant.user_id) {
      await recordFounderCheckpoint({ participantId: participant.id, userId: participant.user_id, checkpoint: "approved" }, { client });
    }
    await recordFounderProgramEvent({
      eventName: "founder_review_approved",
      participantId: participant.id,
      properties: { capacity_override: input.capacityOverride === true },
    });
    return { ok: true, state: followUp.ok ? "agreement_pending" : "approved" };
  }

  const eventByDecision = {
    start_review: "founder_review_started",
    reject: "founder_review_rejected",
    waitlist: "founder_review_waitlisted",
  } as const;
  await recordFounderProgramEvent({ eventName: eventByDecision[input.decision], participantId: participant.id });
  return { ok: true, state: to };
}

export async function setFounderParticipantInternalFields(
  input: { participantId: string; operatorUserId: string; internalOwnerUserId?: string | null; cohort?: string | null },
  deps: { client?: SupabaseLike } = {},
): Promise<{ ok: boolean }> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "set_internal_fields", actorUserId: input.operatorUserId });
  const patch: Record<string, unknown> = {};
  if (input.internalOwnerUserId !== undefined) patch.internal_owner_user_id = input.internalOwnerUserId;
  if (input.cohort !== undefined) patch.cohort = typeof input.cohort === "string" ? input.cohort.trim().slice(0, 80) || null : null;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await client.from("founder_participants").update(patch).eq("id", input.participantId);
  return { ok: !error };
}

/**
 * Records the founder-program consequences of a pilot-agreement acceptance
 * (the acceptance row itself is written by the existing route — single
 * source of truth). No-op for non-participants; tolerant of version
 * mismatches (a stale version simply does not advance the lifecycle).
 */
export async function syncFounderAgreementAcceptance(
  input: { userId: string; agreementVersion: string; requiredAgreementVersion: string },
  deps: { client?: SupabaseLike } = {},
): Promise<void> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "sync_agreement_acceptance", actorUserId: input.userId });
  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state, user_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!participant) return;

  await client
    .from("founder_participants")
    .update({ agreement_version_accepted: input.agreementVersion })
    .eq("id", participant.id);

  if (participant.lifecycle_state !== "agreement_pending" || input.agreementVersion !== input.requiredAgreementVersion) {
    return;
  }

  const accepted = await applyFounderProgramTransition(
    { participantId: participant.id, from: "agreement_pending", to: "agreement_accepted", actor: "participant", actorUserId: input.userId },
    { client },
  );
  if (!accepted.ok) return;

  await recordFounderCheckpoint({ participantId: participant.id, userId: input.userId, checkpoint: "agreement_accepted" }, { client });
  await recordFounderProgramEvent({ eventName: "founder_agreement_accepted", participantId: participant.id });

  // Automatic: agreement accepted → ready for operator activation.
  await applyFounderProgramTransition(
    { participantId: participant.id, from: "agreement_accepted", to: "onboarding_pending", actor: "system" },
    { client },
  );
}

/**
 * A newer required agreement version regresses PRE-ACCESS states back to
 * agreement_pending (docs/founder-program/03). Participants already in
 * access states keep access but are flagged for renewal in the dashboard —
 * they are never silently downgraded.
 */
export async function reconcileFounderAgreementVersion(
  participant: { id: string; lifecycle_state: FounderLifecycleState; agreement_version_accepted: string | null },
  requiredAgreementVersion: string,
  deps: { client?: SupabaseLike } = {},
): Promise<boolean> {
  if (!["agreement_accepted", "onboarding_pending"].includes(participant.lifecycle_state)) return false;
  if (participant.agreement_version_accepted === requiredAgreementVersion) return false;
  const client = deps.client ?? createFounderProgramDbClient({ operation: "reconcile_agreement_version" });
  const result = await applyFounderProgramTransition(
    {
      participantId: participant.id,
      from: participant.lifecycle_state,
      to: "agreement_pending",
      actor: "system",
      reason: "agreement_version_changed",
    },
    { client },
  );
  return result.ok;
}

export type ActivateFounderParticipantResult =
  | { readonly ok: true; readonly workspaceId: string; readonly alreadyActive: boolean }
  | {
      readonly ok: false;
      readonly code:
        | "participant_not_found"
        | "not_ready_for_activation"
        | "agreement_not_accepted"
        | "no_bound_user"
        | "capacity_reached"
        | "activation_failed";
    };

export type ActivateFounderParticipantDeps = {
  client?: SupabaseLike;
  /** Injected workspace bootstrap (default: the existing ensureUserWorkspace). */
  ensureWorkspace?: (userId: string) => Promise<{ workspaceId: string }>;
  /** Injected agreement lookup (default: pilot_agreement_acceptances by user+version). */
  hasCurrentAgreementAcceptance?: (userId: string, version: string) => Promise<boolean>;
};

export async function activateFounderParticipant(
  input: { participantId: string; operatorUserId: string; settings: FounderProgramSettings },
  deps: ActivateFounderParticipantDeps = {},
): Promise<ActivateFounderParticipantResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "activate_participant", actorUserId: input.operatorUserId });
  const participant = await getParticipant(client, input.participantId);
  if (!participant) return { ok: false, code: "participant_not_found" };

  // Idempotency: re-activating an already-active participant is a no-op.
  if (grantsProgramAccess(participant.lifecycle_state) && participant.workspace_id) {
    return { ok: true, workspaceId: participant.workspace_id, alreadyActive: true };
  }
  if (participant.lifecycle_state !== "onboarding_pending") {
    return { ok: false, code: "not_ready_for_activation" };
  }
  if (!participant.user_id) return { ok: false, code: "no_bound_user" };

  const hasAcceptance = deps.hasCurrentAgreementAcceptance
    ? await deps.hasCurrentAgreementAcceptance(participant.user_id, input.settings.requiredAgreementVersion)
    : await defaultHasAcceptance(client, participant.user_id, input.settings.requiredAgreementVersion);
  if (!hasAcceptance) return { ok: false, code: "agreement_not_accepted" };

  let workspaceId = participant.workspace_id;
  if (!workspaceId) {
    const ensure = deps.ensureWorkspace ?? (async (userId: string) => {
      const { ensureUserWorkspace } = await import("@/lib/workspaces");
      const ensured = await ensureUserWorkspace(userId);
      return { workspaceId: ensured.workspaceId };
    });
    try {
      workspaceId = (await ensure(participant.user_id)).workspaceId;
    } catch {
      return { ok: false, code: "activation_failed" };
    }
  }

  // Atomic: active-capacity check + CAS state change + audit row.
  const transition = await applyFounderProgramTransition(
    { participantId: participant.id, from: "onboarding_pending", to: "onboarding_active", actor: "operator", actorUserId: input.operatorUserId },
    { client },
  );
  if (!transition.ok) {
    if (transition.code === "capacity_reached") return { ok: false, code: "capacity_reached" };
    // A concurrent duplicate activation surfaces as state_conflict — check
    // whether the other writer already won (idempotent success).
    if (transition.code === "state_conflict") {
      const fresh = await getParticipant(client, input.participantId);
      if (fresh && grantsProgramAccess(fresh.lifecycle_state) && fresh.workspace_id) {
        return { ok: true, workspaceId: fresh.workspace_id, alreadyActive: true };
      }
    }
    return { ok: false, code: "activation_failed" };
  }

  await client.from("founder_participants").update({ workspace_id: workspaceId }).eq("id", participant.id);
  await recordFounderCheckpoint({ participantId: participant.id, userId: participant.user_id, checkpoint: "workspace_ready" }, { client });
  await recordFounderProgramEvent({ eventName: "founder_activation_granted", participantId: participant.id });

  return { ok: true, workspaceId, alreadyActive: false };
}

async function defaultHasAcceptance(client: SupabaseLike, userId: string, version: string): Promise<boolean> {
  const { data } = await client
    .from("pilot_agreement_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("agreement_version", version)
    .maybeSingle();
  return Boolean(data);
}

export type FounderLifecycleAction = "pause" | "resume" | "revoke" | "complete";

export async function applyFounderLifecycleAction(
  input: { participantId: string; operatorUserId: string; action: FounderLifecycleAction; reason?: string | null },
  deps: { client?: SupabaseLike } = {},
): Promise<FounderAdmissionResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: `participant_${input.action}`, actorUserId: input.operatorUserId });
  const participant = await getParticipant(client, input.participantId);
  if (!participant) return { ok: false, code: "participant_not_found" };

  const to: Record<FounderLifecycleAction, FounderLifecycleState> = {
    pause: "paused",
    resume: "onboarding_active",
    revoke: "revoked",
    complete: "completed",
  };

  const transition = await applyFounderProgramTransition(
    {
      participantId: participant.id,
      from: participant.lifecycle_state,
      to: to[input.action],
      actor: "operator",
      actorUserId: input.operatorUserId,
      reason: input.reason ?? null,
    },
    { client },
  );
  if (!transition.ok) return { ok: false, code: transition.code };

  const stamp: Record<FounderLifecycleAction, Record<string, unknown>> = {
    pause: { paused_at: new Date().toISOString() },
    resume: { paused_at: null },
    revoke: { revoked_at: new Date().toISOString() },
    complete: { completed_at: new Date().toISOString() },
  };
  await client.from("founder_participants").update(stamp[input.action]).eq("id", participant.id);

  const eventByAction = {
    pause: "founder_participant_paused",
    resume: "founder_participant_resumed",
    revoke: "founder_participant_revoked",
    complete: "founder_participant_completed",
  } as const;
  await recordFounderProgramEvent({ eventName: eventByAction[input.action], participantId: participant.id });

  // Resume may immediately re-promote to activated if the criteria already hold.
  if (input.action === "resume") {
    const { maybePromoteToActivated } = await import("@/lib/founder-program/checkpoints");
    await maybePromoteToActivated(participant.id, { client });
  }

  return { ok: true, state: to[input.action] };
}
