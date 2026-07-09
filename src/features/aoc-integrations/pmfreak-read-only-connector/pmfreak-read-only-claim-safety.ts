// AOC PMFreak Read-Only Connector v1 — claim-safety guard
//
// Sweeps a connector output (descriptor, config, snapshot, health, or any
// other value) for prohibited overclaim phrases before it is considered
// safe to return. This connector-specific guard does not replace any
// existing PMFreak claim-safety helper elsewhere in the repo — none was
// found to extend, so this is a standalone guard scoped to this
// connector's outputs.

import {
  AOC_PMFREAK_READ_ONLY_CONNECTOR_DISCLAIMERS,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_PROHIBITED_OVERCLAIM_PHRASES,
  AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS,
} from "./pmfreak-read-only-connector-constants";

export type ClaimSafetyResult = {
  safe: boolean;
  phrases: string[];
};

export class AocPMFreakReadOnlyConnectorOverclaimError extends Error {
  readonly phrases: string[];

  constructor(phrases: string[]) {
    super(`PMFreak Read-Only Connector output contains prohibited overclaim phrase(s): ${phrases.join(", ")}`);
    this.name = "AocPMFreakReadOnlyConnectorOverclaimError";
    this.phrases = phrases;
  }
}

// Safe labels/disclaimers are negations that structurally contain
// substrings which would otherwise match a prohibited phrase (e.g. "No
// mutation performed" vs. "mutation allowed" do not overlap, but safe
// phrases are still stripped first so future safe vocabulary additions
// can't accidentally trip this check).
function stripSafeVocabulary(text: string): string {
  let stripped = text;
  for (const phrase of [...AOC_PMFREAK_READ_ONLY_CONNECTOR_SAFE_LABELS, ...AOC_PMFREAK_READ_ONLY_CONNECTOR_DISCLAIMERS]) {
    stripped = stripped.split(phrase.toLowerCase()).join(" ");
  }
  return stripped;
}

export function evaluateAocPMFreakReadOnlyConnectorClaimSafety(value: unknown): ClaimSafetyResult {
  const text = stripSafeVocabulary(JSON.stringify(value ?? null).toLowerCase());
  const phrases = AOC_PMFREAK_READ_ONLY_CONNECTOR_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => text.includes(phrase));
  return { safe: phrases.length === 0, phrases };
}

export function assertNoAocPMFreakReadOnlyConnectorOverclaim(value: unknown): void {
  const result = evaluateAocPMFreakReadOnlyConnectorClaimSafety(value);
  if (!result.safe) {
    throw new AocPMFreakReadOnlyConnectorOverclaimError(result.phrases);
  }
}
