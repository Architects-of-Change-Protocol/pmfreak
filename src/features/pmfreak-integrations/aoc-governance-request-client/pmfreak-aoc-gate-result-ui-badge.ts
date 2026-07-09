import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import { mapPMFreakAocGateVerdictToUILabel, mapPMFreakAocGateVerdictToUITone } from "./pmfreak-aoc-gate-result-ui-labels";
import type { PMFreakAocGateResultUIIconHint, PMFreakAocGateResultUITone } from "./pmfreak-aoc-gate-result-ui-types";

export type PMFreakAocGateResultUIBadge = {
  label: string;
  tone: PMFreakAocGateResultUITone;
  verdict: PMFreakAocGovernedActionGateVerdict;
  iconHint: PMFreakAocGateResultUIIconHint;
};

const VERDICT_TO_ICON_HINT: Record<PMFreakAocGovernedActionGateVerdict, PMFreakAocGateResultUIIconHint> = {
  passed: "check",
  blocked: "block",
  held: "pause",
  needs_evidence: "evidence",
  needs_approval: "approval",
  needs_review: "review",
  error: "error",
};

export function createPMFreakAocGateResultUIBadge(result: PMFreakAocGovernedActionGateResult): PMFreakAocGateResultUIBadge {
  return {
    label: mapPMFreakAocGateVerdictToUILabel(result.verdict),
    tone: mapPMFreakAocGateVerdictToUITone(result.verdict),
    verdict: result.verdict,
    iconHint: VERDICT_TO_ICON_HINT[result.verdict] ?? "info",
  };
}
