import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import { createPMFreakAocGateResultUIActionHints } from "./pmfreak-aoc-gate-result-ui-action-hint";
import type { PMFreakAocGateResultUIActionHint } from "./pmfreak-aoc-gate-result-ui-action-hint";
import { createPMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import type { PMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import { assertNoPMFreakAocGateResultUIOverclaim } from "./pmfreak-aoc-gate-result-ui-claim-safety";
import { createPMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";
import type { PMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";

export type PMFreakAocGateResultBannerViewModel = {
  kind: "gate_result_banner";
  title: string;
  badge: PMFreakAocGateResultUIBadge;
  message: string;
  safeNextStep: string;
  canProceed: boolean;
  actionHints: PMFreakAocGateResultUIActionHint[];
  safetyText: string;
  presentationOnly: true;
};

export type PMFreakAocGateResultBannerViewModelInput = {
  result: PMFreakAocGovernedActionGateResult;
  config?: Partial<PMFreakAocGateResultUIConfig>;
};

const PASSED_SAFETY_TEXT = "This does not execute the action.";
const DEFAULT_SAFETY_TEXT = "This UI does not execute PMFreak actions.";

// A compact, safe summary banner. For `passed`, `safetyText` explicitly
// says the gate result does not execute the action, so a passed banner is
// never mistaken for confirmation that the action ran.
export function createPMFreakAocGateResultBannerViewModel(input: PMFreakAocGateResultBannerViewModelInput): PMFreakAocGateResultBannerViewModel {
  const { result } = input;
  createPMFreakAocGateResultUIConfig(input.config);

  const candidate: PMFreakAocGateResultBannerViewModel = {
    kind: "gate_result_banner",
    title: "AOC Gate Result",
    badge: createPMFreakAocGateResultUIBadge(result),
    message: result.safeSummary,
    safeNextStep: result.safeNextStep,
    canProceed: result.canProceed,
    actionHints: createPMFreakAocGateResultUIActionHints(result),
    safetyText: result.verdict === "passed" ? PASSED_SAFETY_TEXT : DEFAULT_SAFETY_TEXT,
    presentationOnly: true,
  };

  assertNoPMFreakAocGateResultUIOverclaim(candidate);

  return candidate;
}
