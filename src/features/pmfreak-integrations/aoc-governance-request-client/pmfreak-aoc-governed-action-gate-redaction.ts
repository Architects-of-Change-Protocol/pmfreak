import { redactPMFreakAocGovernancePayloadValue } from "./pmfreak-aoc-redaction";
import type { PMFreakAocGovernedActionGateRedactionMode } from "./pmfreak-aoc-governed-action-gate-config";

const METADATA_LIKE_KEY_PATTERN = /^(metadata|raw|payload|context)$/i;

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
// `strict`. `strict` additionally clears any free-form metadata-like bag
// entirely, since its shape is caller-defined and cannot be safely
// scrubbed field-by-field. Never mutates `value`.
export function redactPMFreakAocGovernedActionGateValue(value: unknown, mode: PMFreakAocGovernedActionGateRedactionMode): unknown {
  const redacted = redactPMFreakAocGovernancePayloadValue(value, mode);
  return mode === "strict" ? clearMetadataLikePayloads(redacted) : redacted;
}
