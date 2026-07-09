import {
  PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES,
  PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES,
} from "./pmfreak-aoc-claim-safety";
import { PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS } from "./pmfreak-aoc-remote-governance-transport-constants";
import { PMFreakAocRemoteGovernanceTransportError } from "./pmfreak-aoc-remote-governance-errors";

// Reuses the base PMFreak AOC Governance Request Client's prohibited
// overclaim phrase list rather than forking a second copy.
export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_PROHIBITED_OVERCLAIM_PHRASES =
  PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES;

export const PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CLAIM_SAFE_PHRASES = [
  ...PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES,
  ...PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_SAFE_LABELS,
] as const;

export type PMFreakAocRemoteGovernanceTransportClaimSafetyResult = {
  safe: boolean;
  unsafePhrases: string[];
  checkedText: string;
};

export function evaluatePMFreakAocRemoteGovernanceTransportClaimSafety(
  value: unknown,
): PMFreakAocRemoteGovernanceTransportClaimSafetyResult {
  const checkedText = JSON.stringify(value ?? null).toLowerCase();
  const unsafePhrases = PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) =>
    checkedText.includes(phrase),
  );
  return { safe: unsafePhrases.length === 0, unsafePhrases, checkedText };
}

export function assertNoPMFreakAocRemoteGovernanceTransportOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocRemoteGovernanceTransportClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocRemoteGovernanceTransportError(
      "unsafe_claim",
      `Output contains prohibited overclaim phrase(s): ${result.unsafePhrases.join(", ")}`,
      { unsafePhrases: result.unsafePhrases },
    );
  }
}
