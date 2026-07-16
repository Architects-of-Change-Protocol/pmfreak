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
 * Derives product-usage checkpoints from REAL domain records — never from
 * client self-reporting (no fake activation): a project row in the
 * participant's program workspace ⇒ first_project_created; an execution
 * task in that workspace ⇒ first_data_entered; any platform event for the
 * workspace ⇒ first_core_capability_used. Runs opportunistically on status/
 * dashboard loads; every record is idempotent.
 */
export async function reconcileFounderUsageCheckpoints(
  participant: { id: string; user_id: string | null; workspace_id: string | null },
  deps: { client?: SupabaseLike } = {},
): Promise<void> {
  if (!participant.workspace_id) return;
  const client = deps.client ?? createFounderProgramDbClient({ operation: "reconcile_usage_checkpoints" });

  const { data: projects } = await client
    .from("projects")
    .select("id")
    .eq("workspace_id", participant.workspace_id)
    .limit(1);
  if (projects && projects.length > 0) {
    await recordFounderCheckpoint({ participantId: participant.id, userId: participant.user_id, checkpoint: "first_project_created" }, { client });
  }

  const { data: tasks } = await client
    .from("execution_tasks")
    .select("id")
    .eq("workspace_id", participant.workspace_id)
    .limit(1);
  if (tasks && tasks.length > 0) {
    await recordFounderCheckpoint({ participantId: participant.id, userId: participant.user_id, checkpoint: "first_data_entered" }, { client });
  }

  const { data: events } = await client
    .from("platform_events")
    .select("id")
    .eq("workspace_id", participant.workspace_id)
    .limit(1);
  if (events && events.length > 0) {
    await recordFounderCheckpoint({ participantId: participant.id, userId: participant.user_id, checkpoint: "first_core_capability_used" }, { client });
  }
}

/**
 * Explicit, flag-gated hook for the command-center page (an explicit,
 * removable call — not hidden coupling). Fails silently: a founder-program
 * outage can never affect the command center itself.
 */
export async function noteFounderCommandCenterVisit(userId: string): Promise<void> {
  try {
    const { resolveFounderProgramFlags } = await import("@/lib/founder-program/config");
    if (!resolveFounderProgramFlags().programEnabled) return;
    const client = createFounderProgramDbClient({ operation: "note_command_center_visit", actorUserId: userId });
    const { data: participant } = await client
      .from("founder_participants")
      .select("id, lifecycle_state, user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!participant) return;
    if (!["onboarding_active", "activated", "feedback_active"].includes(participant.lifecycle_state)) return;
    await recordFounderCheckpoint({ participantId: participant.id, userId, checkpoint: "first_command_center_visit" }, { client });
  } catch {
    // Never let program bookkeeping break a core surface.
  }
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
