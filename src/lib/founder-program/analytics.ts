/**
 * Founder Circle Program — privacy-conscious first-party product analytics.
 *
 * Events land in `founder_program_events` (service-role only). This module
 * is the ONLY writer and the central schema registry: event names and
 * property keys are allowlisted, and property VALUES are restricted to
 * enum-like scalars (short, no "@", no whitespace) so emails, tokens, free
 * text, and document content can never leak into analytics even by
 * accident. See docs/founder-program/08-product-analytics.md.
 *
 * Classification: OPTIONAL TELEMETRY. Lifecycle evidence lives in
 * `founder_membership_transitions` (authoritative, transactional with the
 * state change). An analytics insert failure never breaks the workflow —
 * this function does not throw.
 */
import { resolveFounderProgramFlags } from "@/lib/founder-program/config";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { logger } from "@/lib/observability/logger";

export const FOUNDER_EVENT_SCHEMA_VERSION = 1;

export const FOUNDER_PROGRAM_EVENT_NAMES = [
  "founder_invitation_created",
  "founder_invitation_viewed",
  "founder_invitation_revoked",
  "founder_invitation_resent",
  "founder_invitation_expired",
  "founder_application_submitted",
  "founder_application_withdrawn",
  "founder_review_started",
  "founder_review_approved",
  "founder_review_rejected",
  "founder_review_waitlisted",
  "founder_agreement_accepted",
  "founder_activation_granted",
  "founder_activation_completed",
  "founder_participant_paused",
  "founder_participant_resumed",
  "founder_participant_revoked",
  "founder_participant_completed",
  "founder_participant_withdrawn",
  "founder_lifecycle_transition",
  "founder_checkpoint_reached",
  "founder_feedback_submitted",
  "founder_feedback_triaged",
  "founder_discovery_session_recorded",
  "founder_program_decision_recorded",
  "founder_return_visit",
] as const;

export type FounderProgramEventName = (typeof FOUNDER_PROGRAM_EVENT_NAMES)[number];

/** Only these property keys may appear in an event payload. */
export const FOUNDER_EVENT_ALLOWED_PROPERTY_KEYS = [
  "from_state",
  "to_state",
  "actor_type",
  "archetype",
  "checkpoint",
  "feedback_type",
  "severity",
  "status",
  "session_type",
  "decision",
  "batch_size",
  "capacity_scope",
  "capacity_override",
  "product_area",
  "willingness_to_pay",
  "reason_code",
  "days_since_previous_visit",
] as const;

type AllowedPropertyKey = (typeof FOUNDER_EVENT_ALLOWED_PROPERTY_KEYS)[number];

export type FounderEventProperties = Partial<Record<AllowedPropertyKey, string | number | boolean | null>>;

const MAX_STRING_VALUE_LENGTH = 64;
// Enum-like values only: no whitespace, no "@" (emails), no "/" or "?"
// (URLs/tokens). Free text belongs in founder_feedback / discovery records,
// never in analytics.
const ENUM_LIKE_VALUE = /^[a-z0-9_.:-]*$/i;

export type FounderEventValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem: "unknown_event" | "unknown_property" | "invalid_value" };

export function validateFounderProgramEvent(eventName: unknown, properties: Record<string, unknown> = {}): FounderEventValidation {
  if (typeof eventName !== "string" || !(FOUNDER_PROGRAM_EVENT_NAMES as readonly string[]).includes(eventName)) {
    return { ok: false, problem: "unknown_event" };
  }
  for (const [key, value] of Object.entries(properties)) {
    if (!(FOUNDER_EVENT_ALLOWED_PROPERTY_KEYS as readonly string[]).includes(key)) {
      return { ok: false, problem: "unknown_property" };
    }
    if (value === null || typeof value === "boolean") continue;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return { ok: false, problem: "invalid_value" };
      continue;
    }
    if (typeof value === "string") {
      if (value.length > MAX_STRING_VALUE_LENGTH || !ENUM_LIKE_VALUE.test(value)) {
        return { ok: false, problem: "invalid_value" };
      }
      continue;
    }
    return { ok: false, problem: "invalid_value" };
  }
  return { ok: true };
}

export type RecordFounderEventInput = {
  eventName: FounderProgramEventName;
  participantId?: string | null;
  cohort?: string | null;
  properties?: FounderEventProperties;
};

export type RecordFounderEventResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly skipped: "analytics_disabled" | "invalid_event" | "insert_failed" };

export type RecordFounderEventDeps = {
  client?: { from: (table: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } };
  env?: Record<string, string | undefined>;
};

export async function recordFounderProgramEvent(
  input: RecordFounderEventInput,
  deps: RecordFounderEventDeps = {},
): Promise<RecordFounderEventResult> {
  const flags = resolveFounderProgramFlags(deps.env ?? process.env);
  if (!flags.analyticsEnabled) {
    return { ok: false, skipped: "analytics_disabled" };
  }

  const validation = validateFounderProgramEvent(input.eventName, (input.properties ?? {}) as Record<string, unknown>);
  if (!validation.ok) {
    logger.warn("founder_program_event_rejected", { event_name: String(input.eventName), problem: validation.problem });
    return { ok: false, skipped: "invalid_event" };
  }

  try {
    const client = deps.client ?? createFounderProgramDbClient({ operation: "record_analytics_event" });
    const { error } = await client.from("founder_program_events").insert({
      event_name: input.eventName,
      schema_version: FOUNDER_EVENT_SCHEMA_VERSION,
      participant_id: input.participantId ?? null,
      cohort: input.cohort ?? null,
      properties: input.properties ?? {},
    });
    if (error) {
      logger.warn("founder_program_event_insert_failed", { event_name: input.eventName });
      return { ok: false, skipped: "insert_failed" };
    }
    return { ok: true };
  } catch {
    logger.warn("founder_program_event_insert_failed", { event_name: input.eventName });
    return { ok: false, skipped: "insert_failed" };
  }
}
