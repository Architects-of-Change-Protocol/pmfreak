import { PLATFORM_EVENT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
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
// Reject any event payload containing these keys at ANY nesting depth.
// Raw data belongs to the customer — events capture structured facts only.

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

// Returns "path.to.key" if a forbidden key is found anywhere in the structure,
// null if the payload is clean. Traverses objects and arrays recursively.
function detectForbiddenKeys(
  value: unknown,
  path: string = ""
): string | null {
  if (value === null || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = detectForbiddenKeys(value[i], `${path}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_PAYLOAD_KEYS.has(key.toLowerCase())) {
      return fullPath;
    }
    const found = detectForbiddenKeys(
      (value as Record<string, unknown>)[key],
      fullPath
    );
    if (found !== null) return found;
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

// ─── Column selection — single source of truth from database-contract.ts ─────

const PLATFORM_EVENT_COLUMNS = PLATFORM_EVENT_SELECTABLE_COLUMNS.join(",");

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
  const actorType: PlatformEventActorType = input.actorType ?? "system";
  if (!VALID_ACTOR_TYPES.includes(actorType)) {
    return {
      ok: false,
      error: `actorType must be one of: ${VALID_ACTOR_TYPES.join(", ")}.`,
      failureClass: "validation_failed",
    };
  }

  // Enforce actor_id coherence: human actors must have an actor_id
  if (actorType === "user" && !input.actorId) {
    return {
      ok: false,
      error: "actorId is required when actorType is 'user'.",
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

  // Validate payload — recursively reject forbidden keys at any nesting depth
  const payload = input.eventPayload ?? {};
  const forbiddenPath = detectForbiddenKeys(payload);
  if (forbiddenPath !== null) {
    return {
      ok: false,
      error: `Forbidden payload key detected: ${forbiddenPath}. Raw content must not be stored in governance events. Raw data belongs to the customer.`,
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
