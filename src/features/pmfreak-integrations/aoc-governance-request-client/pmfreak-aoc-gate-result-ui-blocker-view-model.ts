import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import { assertNoPMFreakAocGateResultUIOverclaim } from "./pmfreak-aoc-gate-result-ui-claim-safety";
import { mapPMFreakAocGateVerdictToUILabel } from "./pmfreak-aoc-gate-result-ui-labels";

export type PMFreakAocGateResultBlockerEntry = {
  blockerId: string;
  label: string;
  reasonCode: string;
  requiredReferenceIds: string[];
};

export type PMFreakAocGateResultBlockerViewModel = {
  kind: "gate_result_blocker";
  visible: boolean;
  verdict: PMFreakAocGovernedActionGateVerdict;
  title: string;
  message: string;
  blockers: PMFreakAocGateResultBlockerEntry[];
  safeNextStep: string;
  presentationOnly: true;
};

const EVIDENCE_REASON_CODES = new Set(["aoc_requires_evidence"]);
const APPROVAL_REASON_CODES = new Set(["aoc_requires_pm_approval", "aoc_requires_executive_approval"]);

function labelForReasonCode(code: string): string {
  return code.replace(/_/g, " ");
}

function referencesForReasonCode(code: string, result: PMFreakAocGovernedActionGateResult): string[] {
  if (EVIDENCE_REASON_CODES.has(code)) {
    return [...result.missingEvidenceIds];
  }
  if (APPROVAL_REASON_CODES.has(code)) {
    return [...result.missingApprovalIds];
  }
  return [];
}

// `visible` is false only for `passed` — every other verdict (including
// `held`, which blocks nothing on the AOC side but is not yet safe to act
// on) surfaces its reason codes as blocker entries. Reason codes and
// their labels come straight from the gate result; this never invents
// wording like "violation" or "legally blocked" that the source doesn't
// already provide.
export function createPMFreakAocGateResultBlockerViewModel(result: PMFreakAocGovernedActionGateResult): PMFreakAocGateResultBlockerViewModel {
  const visible = result.verdict !== "passed";

  const blockers: PMFreakAocGateResultBlockerEntry[] = visible
    ? result.reasonCodes.map((code, index) => ({
        blockerId: `gate.ui.blocker.${index}.${code}`,
        label: labelForReasonCode(code),
        reasonCode: code,
        requiredReferenceIds: referencesForReasonCode(code, result),
      }))
    : [];

  const candidate: PMFreakAocGateResultBlockerViewModel = {
    kind: "gate_result_blocker",
    visible,
    verdict: result.verdict,
    title: mapPMFreakAocGateVerdictToUILabel(result.verdict),
    message: result.safeSummary,
    blockers,
    safeNextStep: result.safeNextStep,
    presentationOnly: true,
  };

  assertNoPMFreakAocGateResultUIOverclaim(candidate);

  return candidate;
}
