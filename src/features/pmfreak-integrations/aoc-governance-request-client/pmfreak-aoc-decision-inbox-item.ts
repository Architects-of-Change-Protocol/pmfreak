// Deterministic, filesystem/network-free slugging: lowercase, collapse
// anything outside [a-z0-9._-] into a single hyphen, trim stray separators.
// Mirrors pmfreak-aoc-request-builder.ts / pmfreak-aoc-local-governance-transport.ts.
function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function buildPMFreakAocDecisionInboxItemId(responseId: string): string {
  return `pmfreak.aoc.inbox.${toSafeIdSegment(responseId)}.v1`;
}
