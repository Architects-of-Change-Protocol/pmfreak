/**
 * Founder Circle Program — the only code path that changes a participant's
 * lifecycle state.
 *
 * Order of enforcement:
 *   1. Application-level transition policy (lifecycle.ts allowlist:
 *      from/to pair, actor class, reason requirement).
 *   2. Database function `founder_program_transition`: settings row locked,
 *      capacity checked atomically, compare-and-swap on the current state,
 *      append-only audit row inserted — all in one transaction.
 *   3. Security event (`founder_program_transition`) as a secondary channel,
 *      and an optional analytics event (never blocking).
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import {
  checkFounderTransition,
  type FounderLifecycleState,
  type FounderTransitionActor,
} from "@/lib/founder-program/lifecycle";
import { logSecurityEvent } from "@/lib/security/telemetry";

export type ApplyFounderTransitionInput = {
  participantId: string;
  from: FounderLifecycleState;
  to: FounderLifecycleState;
  actor: FounderTransitionActor;
  /** Required for operator/participant transitions; null for system actors. */
  actorUserId?: string | null;
  reason?: string | null;
  /** Explicit, audited capacity override (operator approve only). */
  capacityOverride?: boolean;
};

export type FounderTransitionFailureCode =
  | "unknown_state"
  | "terminal_state"
  | "invalid_transition"
  | "actor_not_allowed"
  | "reason_required"
  | "capacity_reached"
  | "state_conflict"
  | "participant_not_found"
  | "settings_missing"
  | "transition_failed";

export type ApplyFounderTransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: FounderTransitionFailureCode };

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type ApplyFounderTransitionDeps = {
  client?: RpcClient;
  recordEvent?: typeof recordFounderProgramEvent;
  logEvent?: typeof logSecurityEvent;
};

const MAX_REASON_LENGTH = 500;

const RPC_FAILURE_CODES: readonly FounderTransitionFailureCode[] = [
  "capacity_reached",
  "state_conflict",
  "participant_not_found",
  "settings_missing",
] as const;

export async function applyFounderProgramTransition(
  input: ApplyFounderTransitionInput,
  deps: ApplyFounderTransitionDeps = {},
): Promise<ApplyFounderTransitionResult> {
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, MAX_REASON_LENGTH) : null;

  const policy = checkFounderTransition({ from: input.from, to: input.to, actor: input.actor, reason });
  if (!policy.allowed) {
    return { ok: false, code: policy.reason };
  }

  const client = deps.client ?? createFounderProgramDbClient({ operation: "apply_transition", actorUserId: input.actorUserId ?? null });
  const { data, error } = await client.rpc("founder_program_transition", {
    p_participant_id: input.participantId,
    p_expected_from: input.from,
    p_to: input.to,
    p_actor_type: input.actor,
    p_actor_user_id: input.actorUserId ?? null,
    p_reason: reason,
    p_capacity_scope: policy.rule.capacityScope ?? null,
    p_capacity_override: input.capacityOverride === true,
  });

  if (error) {
    return { ok: false, code: "transition_failed" };
  }
  if (data !== "ok") {
    const code = RPC_FAILURE_CODES.find((candidate) => candidate === data) ?? "transition_failed";
    return { ok: false, code };
  }

  // Secondary audit channel — the authoritative record is the append-only
  // founder_membership_transitions row the SQL function already inserted.
  await (deps.logEvent ?? logSecurityEvent)("founder_program_transition", {
    actorUserId: input.actorUserId ?? null,
    routeId: "founder-program",
    resourceType: "founder_participant",
    resourceId: input.participantId,
    metadata: {
      from_state: input.from,
      to_state: input.to,
      actor_type: input.actor,
      capacity_override: input.capacityOverride === true,
    },
  });

  await (deps.recordEvent ?? recordFounderProgramEvent)({
    eventName: "founder_lifecycle_transition",
    participantId: input.participantId,
    properties: {
      from_state: input.from,
      to_state: input.to,
      actor_type: input.actor,
    },
  });

  return { ok: true };
}
