import { PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES, PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES } from "./pmfreak-aoc-claim-safety";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

// Lowercase, for substring matching. Extends the base module's phrase
// corpus with a few phrases specific to a display/inbox surface
// ("execution approved", "action executed", "decision enforced").
export const PMFREAK_AOC_DECISION_INBOX_PROHIBITED_OVERCLAIM_PHRASES = [
  ...PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES,
  "execution approved",
  "action executed",
  "decision enforced",
] as const;

// Known-safe phrases used throughout this feature's outputs. These must
// never trip the prohibited-overclaim scan above.
export const PMFREAK_AOC_DECISION_INBOX_CLAIM_SAFE_PHRASES = [
  ...PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES,
  "AOC decision display",
  "AOC decision inbox",
  "Display only",
  "No decision writeback performed",
  "Billing review required",
] as const;

export type PMFreakAocDecisionInboxClaimSafetyResult = {
  safe: boolean;
  unsafePhrases: string[];
  checkedText: string;
};

export function evaluatePMFreakAocDecisionInboxClaimSafety(value: unknown): PMFreakAocDecisionInboxClaimSafetyResult {
  const checkedText = JSON.stringify(value ?? null).toLowerCase();
  const unsafePhrases = PMFREAK_AOC_DECISION_INBOX_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => checkedText.includes(phrase));
  return { safe: unsafePhrases.length === 0, unsafePhrases, checkedText };
}

export function assertNoPMFreakAocDecisionInboxOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocDecisionInboxClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocGovernanceClientError("unsafe_claim", `Output contains prohibited overclaim phrase(s): ${result.unsafePhrases.join(", ")}`, {
      unsafePhrases: result.unsafePhrases,
    });
  }
}
