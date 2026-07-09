import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

// Lowercase, for substring matching in evaluatePMFreakAocGovernanceClaimSafety.
export const PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES = [
  "fully trusted agent",
  "certified enterprise compliant",
  "risk-free execution",
  "production authorized",
  "invoice-ready certified",
  "invoice ready certified",
  "customer acceptance certified",
  "contractually compliant",
  "legally approved",
  "compliance passed",
  "guaranteed billing",
  "certified audit export",
  "legal evidence package",
  "costa rica compliant",
  "cr compliant",
  "invoice validity certified",
  "billing entitlement guaranteed",
  "customer acceptance legally sufficient",
  "project compliant",
  "production execution approved",
  "action legally authorized",
  "contract violation detected",
  "invoice legally blocked",
  "customer acceptance invalid",
] as const;

// Known-safe phrases used throughout this module's outputs. These must never
// trip the prohibited-overclaim scan above.
export const PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES = [
  "PMFreak consumes AOC Governance",
  "AOC governance request client",
  "No PMFreak mutation performed",
  "No action execution performed",
  "No invoice validity claimed",
  "No customer acceptance certification",
  "Not compliance certification",
  "Not legal advice",
  "Governance decision received",
  "Evidence required",
  "Approval required",
] as const;

export type PMFreakAocGovernanceClaimSafetyResult = {
  safe: boolean;
  foundPhrases: string[];
};

export function evaluatePMFreakAocGovernanceClaimSafety(value: unknown): PMFreakAocGovernanceClaimSafetyResult {
  const text = JSON.stringify(value ?? null).toLowerCase();
  const foundPhrases = PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => text.includes(phrase));
  return { safe: foundPhrases.length === 0, foundPhrases };
}

export function assertNoPMFreakAocGovernanceOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocGovernanceClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocGovernanceClientError(
      "unsafe_claim",
      `Output contains prohibited overclaim phrase(s): ${result.foundPhrases.join(", ")}`,
      { foundPhrases: result.foundPhrases },
    );
  }
}
