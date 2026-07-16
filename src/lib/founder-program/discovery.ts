/**
 * Founder Circle Program — customer-discovery evidence (docs/founder-program/10).
 *
 * Operator-recorded interviews and observed sessions. Recordings are NEVER
 * uploaded or stored by this system — `evidence_ref` is a reference (doc
 * link, filename, note) and consent status is tracked explicitly.
 */
import { recordFounderProgramEvent } from "@/lib/founder-program/analytics";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";

export const FOUNDER_SESSION_TYPES = [
  "discovery",
  "onboarding_observation",
  "usability_review",
  "value_review",
  "retention_review",
  "exit_interview",
] as const;
export const FOUNDER_SESSION_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export const FOUNDER_WTP_SIGNALS = ["unknown", "none", "low", "medium", "high"] as const;
export const FOUNDER_CONSENT_STATUSES = ["not_requested", "requested", "granted", "declined"] as const;

type SupabaseLike = ReturnType<typeof createFounderProgramDbClient>;

const cap = (value: unknown, max: number): string | null | undefined => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed || null : undefined;
};

const oneOf = <T extends readonly string[]>(value: unknown, options: T, fallback: T[number] | null = null): T[number] | null =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T[number]) : fallback;

const isoDate = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
};

export type RecordDiscoverySessionResult =
  | { readonly ok: true; readonly sessionId: string }
  | { readonly ok: false; readonly field?: string; readonly code: "invalid_input" | "participant_not_found" | "record_failed" };

export async function recordFounderDiscoverySession(
  input: { operatorUserId: string; body: Record<string, unknown> },
  deps: { client?: SupabaseLike } = {},
): Promise<RecordDiscoverySessionResult> {
  const b = input.body;
  const participantId = typeof b.participantId === "string" ? b.participantId.trim() : "";
  if (!participantId) return { ok: false, field: "participantId", code: "invalid_input" };

  const sessionType = oneOf(b.sessionType, FOUNDER_SESSION_TYPES);
  if (!sessionType) return { ok: false, field: "sessionType", code: "invalid_input" };
  const status = oneOf(b.status, FOUNDER_SESSION_STATUSES, "scheduled");
  const willingnessToPay = oneOf(b.willingnessToPay, FOUNDER_WTP_SIGNALS, "unknown");
  const consentStatus = oneOf(b.consentStatus, FOUNDER_CONSENT_STATUSES, "not_requested");

  const fields: Record<string, unknown> = {};
  for (const [key, column, max] of [
    ["mainPainPoint", "main_pain_point", 1000],
    ["momentOfValue", "moment_of_value", 1000],
    ["mainFriction", "main_friction", 1000],
    ["requestedCapability", "requested_capability", 500],
    ["findings", "findings", 4000],
    ["followUpActions", "follow_up_actions", 2000],
    ["evidenceRef", "evidence_ref", 300],
  ] as const) {
    const value = cap(b[key], max);
    if (value === undefined) return { ok: false, field: key, code: "invalid_input" };
    fields[column] = value;
  }
  const scheduledFor = isoDate(b.scheduledFor);
  const completedOn = isoDate(b.completedOn);
  if (scheduledFor === undefined) return { ok: false, field: "scheduledFor", code: "invalid_input" };
  if (completedOn === undefined) return { ok: false, field: "completedOn", code: "invalid_input" };

  const client = deps.client ?? createFounderProgramDbClient({ operation: "record_discovery_session", actorUserId: input.operatorUserId });
  const { data: participant } = await client.from("founder_participants").select("id, user_id").eq("id", participantId).maybeSingle();
  if (!participant) return { ok: false, code: "participant_not_found" };

  const { data: row, error } = await client
    .from("founder_discovery_sessions")
    .insert({
      participant_id: participantId,
      session_type: sessionType,
      status,
      scheduled_for: scheduledFor,
      completed_on: completedOn,
      facilitator_user_id: input.operatorUserId,
      willingness_to_pay: willingnessToPay,
      consent_status: consentStatus,
      ...fields,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, code: "record_failed" };

  if (status === "completed") {
    await recordFounderCheckpoint(
      { participantId, userId: participant.user_id ?? null, checkpoint: "first_followup_session_completed" },
      { client },
    );
  }
  await recordFounderProgramEvent({
    eventName: "founder_discovery_session_recorded",
    participantId,
    properties: { session_type: sessionType, status: status ?? "scheduled", willingness_to_pay: willingnessToPay ?? "unknown" },
  });

  return { ok: true, sessionId: row.id };
}

export async function listFounderDiscoverySessions(
  input: { operatorUserId: string; participantId?: string | null },
  deps: { client?: SupabaseLike } = {},
): Promise<readonly Record<string, unknown>[]> {
  const client = deps.client ?? createFounderProgramDbClient({ operation: "list_discovery_sessions", actorUserId: input.operatorUserId });
  let query = client
    .from("founder_discovery_sessions")
    .select(
      "id, participant_id, session_type, status, scheduled_for, completed_on, facilitator_user_id, main_pain_point, moment_of_value, main_friction, requested_capability, willingness_to_pay, findings, follow_up_actions, evidence_ref, consent_status, created_at",
    )
    .order("created_at", { ascending: false });
  if (input.participantId) query = query.eq("participant_id", input.participantId);
  const { data } = await query;
  return data ?? [];
}
