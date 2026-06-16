import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreatePlatformEventInput,
  PlatformEventActorType,
  PlatformEventCategory,
  PlatformEventResult,
  PlatformEventRow,
  PlatformEventSensitivityLevel,
  PlatformEventSource,
  PlatformEventVisibility,
} from "./types";

// ─── Forbidden payload keys ───────────────────────────────────────────────────
// Reject any event payload containing keys that likely carry raw confidential
// content. Raw data belongs to the customer — events capture structured facts.

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "full_email_body",
  "full_contract_text",
  "raw_document_text",
  "password",
  "secret",
  "token",
  "api_key",
  "private_key",
  "access_token",
  "refresh_token",
  "bearer_token",
  "authorization",
]);

function detectForbiddenKeys(payload: Record<string, unknown>): string | null {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key.toLowerCase())) {
      return key;
    }
  }
  return null;
}

// ─── Allowed enum values ──────────────────────────────────────────────────────

const VALID_ACTOR_TYPES: PlatformEventActorType[] = ["user", "ai_agent", "system", "integration"];

const VALID_SOURCES: PlatformEventSource[] = [
  "user_action",
  "ai_agent",
  "system",
  "integration",
  "migration",
  "import",
];

const VALID_VISIBILITY: PlatformEventVisibility[] = [
  "personal",
  "project",
  "workspace",
  "tenant",
  "global_anonymous",
];

const VALID_SENSITIVITY: PlatformEventSensitivityLevel[] = [
  "public",
  "internal",
  "confidential",
  "restricted",
];

const VALID_CATEGORIES: PlatformEventCategory[] = [
  "project",
  "risk",
  "dependency",
  "scope",
  "recommendation",
  "decision",
  "outcome",
  "governance",
  "document",
  "stakeholder",
  "financial",
  "system",
];

// ─── Selectable columns ───────────────────────────────────────────────────────

const PLATFORM_EVENT_COLUMNS = [
  "id",
  "workspace_id",
  "project_id",
  "actor_id",
  "actor_type",
  "event_type",
  "event_category",
  "event_payload",
  "source",
  "correlation_id",
  "causation_id",
  "visibility",
  "sensitivity_level",
  "learning_eligible",
  "raw_reference_table",
  "raw_reference_id",
  "metadata",
  "occurred_at",
  "created_at",
].join(",");

// ─── createPlatformEvent ──────────────────────────────────────────────────────

export async function createPlatformEvent(
  input: CreatePlatformEventInput
): Promise<PlatformEventResult> {
  // Validate workspace
  if (!input.workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "validation_failed" };
  }

  // Validate event_type
  if (!input.eventType?.trim()) {
    return { ok: false, error: "eventType is required.", failureClass: "validation_failed" };
  }

  // Validate event_category
  if (!input.eventCategory || !VALID_CATEGORIES.includes(input.eventCategory)) {
    return {
      ok: false,
      error: `eventCategory must be one of: ${VALID_CATEGORIES.join(", ")}.`,
      failureClass: "validation_failed",
    };
  }

  // Validate actor_type
  const actorType: PlatformEventActorType = input.actorType ?? "user";
  if (!VALID_ACTOR_TYPES.includes(actorType)) {
    return {
      ok: false,
      error: `actorType must be one of: ${VALID_ACTOR_TYPES.join(", ")}.`,
      failureClass: "validation_failed",
    };
  }

  // Validate source
  const source: PlatformEventSource = input.source ?? "system";
  if (!VALID_SOURCES.includes(source)) {
    return {
      ok: false,
      error: `source must be one of: ${VALID_SOURCES.join(", ")}.`,
      failureClass: "validation_failed",
    };
  }

  // Validate visibility
  const visibility: PlatformEventVisibility = input.visibility ?? "workspace";
  if (!VALID_VISIBILITY.includes(visibility)) {
    return {
      ok: false,
      error: `visibility must be one of: ${VALID_VISIBILITY.join(", ")}.`,
      failureClass: "validation_failed",
    };
  }

  // Validate sensitivity_level
  const sensitivityLevel: PlatformEventSensitivityLevel = input.sensitivityLevel ?? "internal";
  if (!VALID_SENSITIVITY.includes(sensitivityLevel)) {
    return {
      ok: false,
      error: `sensitivityLevel must be one of: ${VALID_SENSITIVITY.join(", ")}.`,
      failureClass: "validation_failed",
    };
  }

  // Validate payload — reject forbidden keys
  const payload = input.eventPayload ?? {};
  const forbiddenKey = detectForbiddenKeys(payload);
  if (forbiddenKey) {
    return {
      ok: false,
      error: `event_payload must not contain "${forbiddenKey}". Raw content must not be stored in governance events.`,
      failureClass: "forbidden_payload_key",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("platform_events")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId ?? null,
      actor_id: input.actorId ?? null,
      actor_type: actorType,
      event_type: input.eventType.trim(),
      event_category: input.eventCategory,
      event_payload: payload,
      source,
      correlation_id: input.correlationId ?? null,
      causation_id: input.causationId ?? null,
      visibility,
      sensitivity_level: sensitivityLevel,
      learning_eligible: input.learningEligible ?? false,
      raw_reference_table: input.rawReferenceTable ?? null,
      raw_reference_id: input.rawReferenceId ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select(PLATFORM_EVENT_COLUMNS)
    .single<PlatformEventRow>();

  if (error || !data) {
    console.error("platform_events.create.failed", {
      eventType: input.eventType,
      workspaceId: input.workspaceId,
      error: error?.message,
    });
    return {
      ok: false,
      error: "Unable to record governance event.",
      failureClass: "persistence_failed",
    };
  }

  return { ok: true, event: data };
}
