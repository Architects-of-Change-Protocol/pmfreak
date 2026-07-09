import {
  PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_PROHIBITED_OVERCLAIM_PHRASES,
} from "./pmfreak-aoc-governed-action-gate-claim-safety";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";
import { PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS } from "./pmfreak-aoc-evidence-requirement-handoff-constants";

// Lowercase, for substring matching. Extends the governed action gate
// module's phrase corpus (itself extending decision inbox, which extends
// the base governance client module) with phrases specific to an
// evidence-requirement-handoff surface. Deduped via Set — duplicates in
// the source arrays are harmless for substring `.includes()` checks but
// this keeps the exported corpus clean.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_PROHIBITED_OVERCLAIM_PHRASES = [
  ...new Set([
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
    "execution approved",
    "action executed",
    "decision enforced",
    "automatically executed",
    "invoice approved",
    "customer accepted",
    "evidence validated",
    "evidence approved",
    "evidence attached",
    "task created",
    "email sent",
    "customer notified",
  ]),
] as const;

// Known-safe phrases used throughout this feature's outputs. These must
// never trip the prohibited-overclaim scan above.
export const PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CLAIM_SAFE_PHRASES = [
  ...new Set([
    ...PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES,
    ...PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS,
    "Evidence required",
    "Missing evidence",
    "Approval reference required",
    "Review packet",
    "This handoff does not attach evidence",
    "This handoff does not create tasks",
  ]),
] as const;

export type PMFreakAocEvidenceRequirementHandoffClaimSafetyResult = {
  safe: boolean;
  unsafePhrases: string[];
  checkedText: string;
};

export function evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety(value: unknown): PMFreakAocEvidenceRequirementHandoffClaimSafetyResult {
  const checkedText = JSON.stringify(value ?? null).toLowerCase();
  const unsafePhrases = PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_PROHIBITED_OVERCLAIM_PHRASES.filter((phrase) => checkedText.includes(phrase));
  return { safe: unsafePhrases.length === 0, unsafePhrases, checkedText };
}

export function assertNoPMFreakAocEvidenceRequirementHandoffOverclaim(value: unknown): void {
  const result = evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety(value);
  if (!result.safe) {
    throw new PMFreakAocGovernanceClientError("unsafe_claim", `Output contains prohibited overclaim phrase(s): ${result.unsafePhrases.join(", ")}`, {
      unsafePhrases: result.unsafePhrases,
    });
  }
}
