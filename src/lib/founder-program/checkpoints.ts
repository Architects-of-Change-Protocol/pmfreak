/**
 * Founder Circle Program — onboarding checkpoints and the canonical
 * activation computation.
 *
 * Checkpoints are idempotent facts (unique participant+checkpoint). The
 * "activated" promotion is computed here and applied as a SYSTEM transition
 * only when the participant is `onboarding_active` and every checkpoint in
 * FOUNDER_ACTIVATION_REQUIRED_CHECKPOINTS is present — page views alone
 * never activate anyone (docs/founder-program/03 and 07).
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import {
  FOUNDER_ACTIVATION_REQUIRED_CHECKPOINTS,
  type FounderOnboardingCheckpoint,
} from "@/lib/founder-program/lifecycle";
import { applyFounderProgramTransition } from "@/lib/founder-program/transitions";

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

export type RecordFounderCheckpointInput = {
  participantId: string;
  userId?: string | null;
  checkpoint: FounderOnboardingCheckpoint;
};

export type RecordFounderCheckpointResult = {
  readonly recorded: boolean;
  /** True when this call promoted the participant to `activated`. */
  readonly activationPromoted: boolean;
};

export async function recordFounderCheckpoint(
  input: RecordFounderCheckpointInput,
  deps: { client?: SupabaseLike } = {},
): Promise<RecordFounderCheckpointResult> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "record_checkpoint", actorUserId: input.userId ?? null });

  const { error } = await client.from("founder_onboarding_checkpoints").insert({
    participant_id: input.participantId,
    user_id: input.userId ?? null,
    checkpoint: input.checkpoint,
  });

  const alreadyRecorded = error?.code === "23505";
  if (error && !alreadyRecorded) {
    return { recorded: false, activationPromoted: false };
  }

  if (!alreadyRecorded) {
    await recordFounderProgramEvent({
      eventName: "founder_checkpoint_reached",
      participantId: input.participantId,
      properties: { checkpoint: input.checkpoint },
    });
  }

  const activationPromoted = await maybePromoteToActivated(input.participantId, { client });
  return { recorded: !alreadyRecorded, activationPromoted };
}

export async function getFounderCheckpoints(
  participantId: string,
  deps: { client?: SupabaseLike } = {},
): Promise<readonly { checkpoint: FounderOnboardingCheckpoint; reachedAt: string }[]> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "read_checkpoints" });
  const { data } = await client
    .from("founder_onboarding_checkpoints")
    .select("checkpoint, reached_at")
    .eq("participant_id", participantId)
    .order("reached_at", { ascending: true });
  return (data ?? []).map((row: { checkpoint: string; reached_at: string }) => ({
    checkpoint: row.checkpoint as FounderOnboardingCheckpoint,
    reachedAt: row.reached_at,
  }));
}

export function hasMetActivationCriteria(reached: readonly { checkpoint: FounderOnboardingCheckpoint }[]): boolean {
  const set = new Set(reached.map((entry) => entry.checkpoint));
  return FOUNDER_ACTIVATION_REQUIRED_CHECKPOINTS.every((required) => set.has(required));
}

/**
 * System promotion onboarding_active → activated when the canonical
 * criteria hold. Idempotent: the CAS inside the transition function makes a
 * concurrent double-promotion resolve to exactly one applied transition.
 */
export async function maybePromoteToActivated(
  participantId: string,
  deps: { client?: SupabaseLike } = {},
): Promise<boolean> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "evaluate_activation" });
  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state, user_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.lifecycle_state !== "onboarding_active") return false;

  const reached = await getFounderCheckpoints(participantId, { client });
  if (!hasMetActivationCriteria(reached)) return false;

  const transition = await applyFounderProgramTransition({
    participantId,
    from: "onboarding_active",
    to: "activated",
    actor: "system",
  }, { client });
  if (!transition.ok) return false;

  await client
    .from("founder_participants")
    .update({ activated_at: new Date().toISOString() })
    .eq("id", participantId)
    .is("activated_at", null);

  await client.from("founder_onboarding_checkpoints").insert({
    participant_id: participantId,
    user_id: participant.user_id ?? null,
    checkpoint: "activation_completed",
  });

  await recordFounderProgramEvent({ eventName: "founder_activation_completed", participantId });
  return true;
}
