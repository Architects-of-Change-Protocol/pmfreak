import { PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES, PMFREAK_AOC_GOVERNED_ACTION_GATE_PROHIBITED_OVERCLAIM_PHRASES } from "./pmfreak-aoc-governed-action-gate-claim-safety";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

// Lowercase, for substring matching. Extends the governed action gate
// module's phrase corpus (which itself extends the decision inbox and
// base governance client corpora) with phrases specific to a UI/
// presentation surface that a future renderer or copy change could
// otherwise introduce.
export const PMFREAK_AOC_GATE_RESULT_UI_PROHIBITED_OVERCLAIM_PHRASES = [
  ...PMFREAK_AOC_GOVERNED_ACTION_GATE_PROHIBITED_OVERCLAIM_PHRASES,
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
  "click to execute",
  "execute now",
  "approve invoice",
  "send to customer",
] as const;

// Known-safe phrases used throughout this feature's outputs. These must
// never trip the prohibited-overclaim scan above.
export const PMFREAK_AOC_GATE_RESULT_UI_CLAIM_SAFE_PHRASES = [
  ...PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES,
  "AOC gate result UI",
  "Presentation only",
  "Gate result displayed",
  "This UI does not execute the action",
] as const;

export type PMFreakAocGateResultUIClaimSafetyResult = {
  safe: boolean;
  unsafePhrases: string[];
  checkedText: string;
};

export function evaluatePMFreakAocGateResultUIClaimSafety(value: unknown): PMFreakAocGateResultUIClaimSafetyResult {
  const checkedText = JSON.stringify(value ?? null).toLowerCase();
  const unsafePhrases = PMFREAK_AOC_GATE_RESULT_UI_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => checkedText.includes(phrase));
  return { safe: unsafePhrases.length === 0, unsafePhrases, checkedText };
}

export function assertNoPMFreakAocGateResultUIOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocGateResultUIClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocGovernanceClientError("unsafe_claim", `Output contains prohibited overclaim phrase(s): ${result.unsafePhrases.join(", ")}`, {
      unsafePhrases: result.unsafePhrases,
    });
  }
}
