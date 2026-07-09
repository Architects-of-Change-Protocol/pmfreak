import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import type { PMFreakAocGateResultUITone } from "./pmfreak-aoc-gate-result-ui-types";

const VERDICT_TO_UI_LABEL: Record<PMFreakAocGovernedActionGateVerdict, string> = {
  passed: "Passed",
  blocked: "Blocked",
  held: "Held",
  needs_evidence: "Needs Evidence",
  needs_approval: "Needs Approval",
  needs_review: "Needs Review",
  error: "Error",
};

export function mapPMFreakAocGateVerdictToUILabel(verdict: PMFreakAocGovernedActionGateVerdict): string {
  return VERDICT_TO_UI_LABEL[verdict] ?? VERDICT_TO_UI_LABEL.error;
}

const VERDICT_TO_UI_TONE: Record<PMFreakAocGovernedActionGateVerdict, PMFreakAocGateResultUITone> = {
  passed: "success",
  blocked: "danger",
  held: "warning",
  needs_evidence: "warning",
  needs_approval: "warning",
  needs_review: "warning",
  error: "danger",
};

export function mapPMFreakAocGateVerdictToUITone(verdict: PMFreakAocGovernedActionGateVerdict): PMFreakAocGateResultUITone {
  return VERDICT_TO_UI_TONE[verdict] ?? VERDICT_TO_UI_TONE.error;
}
