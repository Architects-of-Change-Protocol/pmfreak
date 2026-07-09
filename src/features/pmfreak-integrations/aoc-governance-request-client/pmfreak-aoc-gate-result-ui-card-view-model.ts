import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import { createPMFreakAocGateResultUIActionHints } from "./pmfreak-aoc-gate-result-ui-action-hint";
import type { PMFreakAocGateResultUIActionHint } from "./pmfreak-aoc-gate-result-ui-action-hint";
import { createPMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import type { PMFreakAocGateResultUIBadge } from "./pmfreak-aoc-gate-result-ui-badge";
import { assertNoPMFreakAocGateResultUIOverclaim } from "./pmfreak-aoc-gate-result-ui-claim-safety";
import { createPMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";
import type { PMFreakAocGateResultUIConfig } from "./pmfreak-aoc-gate-result-ui-config";

export type PMFreakAocGateResultCardRequirementSummary = {
  requiredEvidenceCount: number;
  requiredApprovalCount: number;
  missingEvidenceCount: number;
  missingApprovalCount: number;
};

export type PMFreakAocGateResultCardViewModel = {
  kind: "gate_result_card";
  title: string;
  subtitle: string;
  badge: PMFreakAocGateResultUIBadge;
  canProceed: boolean;
  primaryMessage: string;
  safeNextStep: string;
  requirementSummary: PMFreakAocGateResultCardRequirementSummary;
  warningCount: number;
  errorCount: number;
  actionHints: PMFreakAocGateResultUIActionHint[];
  presentationOnly: true;
};

export type PMFreakAocGateResultCardViewModelInput = {
  result: PMFreakAocGovernedActionGateResult;
  config?: Partial<PMFreakAocGateResultUIConfig>;
};

export function createPMFreakAocGateResultCardViewModel(input: PMFreakAocGateResultCardViewModelInput): PMFreakAocGateResultCardViewModel {
  const { result } = input;
  createPMFreakAocGateResultUIConfig(input.config);

  const subtitle = result.actionTitle
    ? `Proposed action: ${result.actionTitle}`
    : `AOC governed action gate result for request ${result.requestId ?? "unspecified"}`;

  const candidate: PMFreakAocGateResultCardViewModel = {
    kind: "gate_result_card",
    title: "AOC Gate Result",
    subtitle,
    badge: createPMFreakAocGateResultUIBadge(result),
    canProceed: result.canProceed,
    primaryMessage: result.safeSummary,
    safeNextStep: result.safeNextStep,
    requirementSummary: {
      requiredEvidenceCount: result.requiredEvidenceIds.length,
      requiredApprovalCount: result.requiredApprovalIds.length,
      missingEvidenceCount: result.missingEvidenceIds.length,
      missingApprovalCount: result.missingApprovalIds.length,
    },
    warningCount: result.warnings.length,
    errorCount: result.errors.length,
    actionHints: createPMFreakAocGateResultUIActionHints(result),
    presentationOnly: true,
  };

  assertNoPMFreakAocGateResultUIOverclaim(candidate);

  return candidate;
}
