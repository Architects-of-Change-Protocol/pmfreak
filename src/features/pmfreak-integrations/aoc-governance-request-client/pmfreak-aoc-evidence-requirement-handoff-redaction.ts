import { redactPMFreakAocGovernancePayloadValue } from "./pmfreak-aoc-redaction";
import type { PMFreakAocEvidenceRequirementHandoffRedactionMode } from "./pmfreak-aoc-evidence-requirement-handoff-config";

const REDACTED_PLACEHOLDER = "[redacted]";
const METADATA_LIKE_KEY_PATTERN = /^(metadata|raw|payload|context)$/i;
const BEARER_TOKEN_PATTERN = /\bBearer\s+\S+/gi;
const CONNECTION_STRING_WITH_CREDENTIALS_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'()<>]*@[^\s"'()<>]+/gi;
const FILE_PATH_PATTERN = /(?:[A-Za-z]:\\|\/)[\w./-]+\.(?:pdf|docx?|xlsx?|csv|png|jpe?g|txt|zip)/gi;

function redactTransportLikeString(value: string): string {
  return value
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_PLACEHOLDER}`)
    .replace(CONNECTION_STRING_WITH_CREDENTIALS_PATTERN, REDACTED_PLACEHOLDER)
    .replace(FILE_PATH_PATTERN, REDACTED_PLACEHOLDER);
}

function redactTransportLikeStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return redactTransportLikeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactTransportLikeStrings);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = redactTransportLikeStrings(entryValue);
    }
    return result;
  }
  return value;
}

function clearMetadataLikePayloads(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(clearMetadataLikePayloads);
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = METADATA_LIKE_KEY_PATTERN.test(key) ? {} : clearMetadataLikePayloads(entryValue);
    }
    return result;
  }
  return value;
}

// Reuses the base module's deterministic redaction (email/token/secret
// scrubbing, plus sensitive-key-name scrubbing) for `safe_demo` and
// `strict`, additionally scrubbing bearer tokens, connection strings with
// embedded credentials, and file-path-like strings (mirroring
// pmfreak-aoc-remote-governance-redaction.ts). `strict` additionally
// clears any free-form metadata-like bag entirely, since its shape is
// caller-defined and cannot be safely scrubbed field-by-field. Never
// mutates `value`.
export function redactPMFreakAocEvidenceRequirementHandoffValue(value: unknown, mode: PMFreakAocEvidenceRequirementHandoffRedactionMode): unknown {
  const baseRedacted = redactPMFreakAocGovernancePayloadValue(value, mode);
  if (mode === "none") {
    return baseRedacted;
  }
  const transportRedacted = redactTransportLikeStrings(baseRedacted);
  return mode === "strict" ? clearMetadataLikePayloads(transportRedacted) : transportRedacted;
}
