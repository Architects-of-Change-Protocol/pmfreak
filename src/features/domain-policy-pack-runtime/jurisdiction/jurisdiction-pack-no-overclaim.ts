// AOC Jurisdiction Pack Runtime v1 — no-overclaim guard
//
// Every runtime output (pack metadata, validation results, resolutions,
// compositions, approval/evidence mappings, exports, Control Plane
// summaries) is swept for prohibited compliance/legal-advice language
// before it is considered safe to return or export.

import {
  JURISDICTION_CONTROL_PLANE_SAFE_LABELS,
  JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES,
  JURISDICTION_SAFE_LABELS,
} from "./jurisdiction-pack-constants";

export class JurisdictionOverclaimError extends Error {
  readonly phrases: string[];

  constructor(phrases: string[]) {
    super(`Jurisdiction runtime output contains prohibited overclaim phrase(s): ${phrases.join(", ")}`);
    this.name = "JurisdictionOverclaimError";
    this.phrases = phrases;
  }
}

// A required safe label ("not_legal_advice" / "Not legal advice") is a
// negation that structurally contains a prohibited phrase ("legal
// advice") as a substring. Safe labels are removed before scanning so the
// required disclaimers never trip the very check they exist to satisfy —
// this does not weaken detection because none of the safe labels overlap
// with a prohibited phrase in any other way (verified in
// jurisdiction-pack-no-overclaim.test.ts).
function stripSafeLabels(text: string): string {
  let stripped = text;
  for (const label of [...JURISDICTION_SAFE_LABELS, ...JURISDICTION_CONTROL_PLANE_SAFE_LABELS]) {
    stripped = stripped.split(label.toLowerCase()).join(" ");
  }
  return stripped;
}

export function findJurisdictionOverclaimPhrases(value: unknown): string[] {
  const text = stripSafeLabels(JSON.stringify(value ?? null).toLowerCase());
  return JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => text.includes(phrase));
}

// Throws JurisdictionOverclaimError if `value` (stringified) contains any
// prohibited phrase. Intended for use on runtime outputs, not on the
// prohibited-phrase list itself.
export function assertNoJurisdictionOverclaim(value: unknown): void {
  const found = findJurisdictionOverclaimPhrases(value);
  if (found.length > 0) {
    throw new JurisdictionOverclaimError(found);
  }
}
