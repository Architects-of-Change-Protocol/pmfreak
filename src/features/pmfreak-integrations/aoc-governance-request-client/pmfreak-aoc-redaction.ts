import type { PMFreakAocGovernanceRedactionMode } from "./pmfreak-aoc-governance-client-types";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";

const REDACTED_PLACEHOLDER = "[redacted]";

const EMAIL_PATTERN = /[^\s"'()<>]+@[^\s"'()<>]+\.[^\s"'()<>]+/g;
const SECRET_LIKE_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{24,}\b/g;

const SENSITIVE_KEY_PATTERN = /(secret|token|password|credential|api[_-]?key|email)/i;

function redactString(value: string): string {
  return value.replace(EMAIL_PATTERN, REDACTED_PLACEHOLDER).replace(SECRET_LIKE_TOKEN_PATTERN, REDACTED_PLACEHOLDER);
}

// Deterministic, offline, deep redaction of a single payload value. `none`
// returns a deep clone of the input untouched; `safe_demo` and `strict` both
// scrub email-like and secret/token-like strings and any value whose object
// key looks sensitive (email, token, secret, password, credential, apiKey).
export function redactPMFreakAocGovernancePayloadValue(value: unknown, mode: PMFreakAocGovernanceRedactionMode): unknown {
  if (mode === "none") {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  const walk = (input: unknown, parentKey?: string): unknown => {
    if (typeof input === "string") {
      if (parentKey && SENSITIVE_KEY_PATTERN.test(parentKey)) {
        return REDACTED_PLACEHOLDER;
      }
      return redactString(input);
    }
    if (Array.isArray(input)) {
      return input.map((entry) => walk(entry, parentKey));
    }
    if (input && typeof input === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, entryValue] of Object.entries(input as Record<string, unknown>)) {
        result[key] = walk(entryValue, key);
      }
      return result;
    }
    return input;
  };

  return walk(value);
}

// `strict` additionally clears free-form metadata bags entirely, since their
// shape is caller-defined and cannot be safely scrubbed field-by-field.
export function redactPMFreakAocGovernanceRequest(
  request: PMFreakAocGovernanceRequest,
  mode: PMFreakAocGovernanceRedactionMode,
): PMFreakAocGovernanceRequest {
  const redacted = redactPMFreakAocGovernancePayloadValue(request, mode) as PMFreakAocGovernanceRequest;

  if (mode === "strict") {
    redacted.actionAttempt = {
      ...redacted.actionAttempt,
      metadata: {},
    };
  }

  return redacted;
}

export function redactPMFreakAocGovernanceResponse(
  response: PMFreakAocGovernanceResponse,
  mode: PMFreakAocGovernanceRedactionMode,
): PMFreakAocGovernanceResponse {
  return redactPMFreakAocGovernancePayloadValue(response, mode) as PMFreakAocGovernanceResponse;
}
