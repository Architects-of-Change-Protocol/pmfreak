// PMFreak AOC Read-Only Integration Surface v1 — claim-safety guard
//
// Sweeps a surface output (descriptor, config, snapshot, health, or any
// other value) for prohibited overclaim phrases before it is considered
// safe to return. This surface-specific guard does not replace any
// existing PMFreak claim-safety helper elsewhere in the repo — none was
// found to extend, so this is a standalone guard scoped to this
// surface's outputs.

import {
  PMFREAK_AOC_READ_ONLY_SURFACE_DISCLAIMERS,
  PMFREAK_AOC_READ_ONLY_SURFACE_PROHIBITED_OVERCLAIM_PHRASES,
  PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS,
} from "./pmfreak-aoc-read-only-surface-constants";

export type ClaimSafetyResult = {
  safe: boolean;
  phrases: string[];
};

export class PMFreakAocReadOnlySurfaceOverclaimError extends Error {
  readonly phrases: string[];

  constructor(phrases: string[]) {
    super(`PMFreak AOC Read-Only Integration Surface output contains prohibited overclaim phrase(s): ${phrases.join(", ")}`);
    this.name = "PMFreakAocReadOnlySurfaceOverclaimError";
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
  for (const phrase of [...PMFREAK_AOC_READ_ONLY_SURFACE_SAFE_LABELS, ...PMFREAK_AOC_READ_ONLY_SURFACE_DISCLAIMERS]) {
    stripped = stripped.split(phrase.toLowerCase()).join(" ");
  }
  return stripped;
}

export function evaluatePMFreakAocReadOnlySurfaceClaimSafety(value: unknown): ClaimSafetyResult {
  const text = stripSafeVocabulary(JSON.stringify(value ?? null).toLowerCase());
  const phrases = PMFREAK_AOC_READ_ONLY_SURFACE_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => text.includes(phrase));
  return { safe: phrases.length === 0, phrases };
}

export function assertNoPMFreakAocReadOnlySurfaceOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocReadOnlySurfaceClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocReadOnlySurfaceOverclaimError(result.phrases);
  }
}
