export const FORBIDDEN_PLATFORM_EVENT_PAYLOAD_KEYS = [
  "full_email_body",
  "full_contract_text",
  "raw_document_text",
  "password",
  "secret",
  "token",
  "api_key",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(FORBIDDEN_PLATFORM_EVENT_PAYLOAD_KEYS);

export type PlatformEventPayloadValidationResult =
  | { ok: true }
  | { ok: false; offendingKey: string; path: string; message: string };

export type PlatformEventActorType = "user" | "system" | "ai_agent";

export type PlatformEventActorValidationResult =
  | { ok: true }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findForbiddenPayloadKey(value: unknown, path: string): { key: string; path: string } | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const childPath = `${path}[${index}]`;
      const found = findForbiddenPayloadKey(item, childPath);
      if (found) return found;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEY_SET.has(key.toLowerCase())) {
      return { key, path: childPath };
    }

    const found = findForbiddenPayloadKey(child, childPath);
    if (found) return found;
  }

  return null;
}

export function validatePlatformEventPayload(payload: unknown): PlatformEventPayloadValidationResult {
  const found = findForbiddenPayloadKey(payload, "");
  if (!found) return { ok: true };

  return {
    ok: false,
    offendingKey: found.key,
    path: found.path,
    message: `Forbidden payload key detected: ${found.path}`,
  };
}

export function assertPlatformEventPayloadAllowed(payload: unknown): void {
  const result = validatePlatformEventPayload(payload);
  if (!result.ok) throw new Error(result.message);
}

export function validatePlatformEventActor(input: { actorType: PlatformEventActorType; actorId?: string | null }): PlatformEventActorValidationResult {
  if (input.actorType === "user" && !input.actorId) {
    return { ok: false, message: "actor_id is required when actor_type is user." };
  }

  return { ok: true };
}
