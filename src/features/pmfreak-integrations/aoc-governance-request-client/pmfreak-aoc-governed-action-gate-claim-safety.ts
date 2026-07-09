import { PMFREAK_AOC_DECISION_INBOX_CLAIM_SAFE_PHRASES, PMFREAK_AOC_DECISION_INBOX_PROHIBITED_OVERCLAIM_PHRASES } from "./pmfreak-aoc-decision-inbox-claim-safety";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

// Lowercase, for substring matching. Extends the decision inbox module's
// phrase corpus (which itself extends the base governance client module's
// corpus) with a few phrases specific to a gate/execution-adjacent surface.
export const PMFREAK_AOC_GOVERNED_ACTION_GATE_PROHIBITED_OVERCLAIM_PHRASES = [
  ...PMFREAK_AOC_DECISION_INBOX_PROHIBITED_OVERCLAIM_PHRASES,
  "automatically executed",
  "invoice approved",
  "customer accepted",
] as const;

// Known-safe phrases used throughout this feature's outputs. These must
// never trip the prohibited-overclaim scan above.
export const PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES = [
  ...PMFREAK_AOC_DECISION_INBOX_CLAIM_SAFE_PHRASES,
  "AOC governed action gate",
  "Gate only",
  "Gate result created",
  "Passed the governance gate",
  "Blocked by governance gate",
  "Needs evidence",
  "Needs approval",
  "Needs review",
] as const;

export type PMFreakAocGovernedActionGateClaimSafetyResult = {
  safe: boolean;
  unsafePhrases: string[];
  checkedText: string;
};

export function evaluatePMFreakAocGovernedActionGateClaimSafety(value: unknown): PMFreakAocGovernedActionGateClaimSafetyResult {
  const checkedText = JSON.stringify(value ?? null).toLowerCase();
  const unsafePhrases = PMFREAK_AOC_GOVERNED_ACTION_GATE_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => checkedText.includes(phrase));
  return { safe: unsafePhrases.length === 0, unsafePhrases, checkedText };
}

export function assertNoPMFreakAocGovernedActionGateOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocGovernedActionGateClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocGovernanceClientError("unsafe_claim", `Output contains prohibited overclaim phrase(s): ${result.unsafePhrases.join(", ")}`, {
      unsafePhrases: result.unsafePhrases,
    });
  }
}
