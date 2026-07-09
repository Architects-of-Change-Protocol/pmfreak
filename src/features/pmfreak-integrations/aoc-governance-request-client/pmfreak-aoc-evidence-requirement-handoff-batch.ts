import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";
import type { PMFreakAocGateResultUIDisplayModel } from "./pmfreak-aoc-gate-result-ui-display-model";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocEvidenceRequirementHandoffConfig } from "./pmfreak-aoc-evidence-requirement-handoff-config";
import { createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem } from "./pmfreak-aoc-evidence-requirement-handoff-from-inbox-item";
import { createPMFreakAocEvidenceRequirementHandoffFromGateResult } from "./pmfreak-aoc-evidence-requirement-handoff-from-gate-result";
import { createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse } from "./pmfreak-aoc-evidence-requirement-handoff-from-response";
import { createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel } from "./pmfreak-aoc-evidence-requirement-handoff-from-ui-display";
import type { PMFreakAocEvidenceRequirementHandoffPackage } from "./pmfreak-aoc-evidence-requirement-handoff-package";

export type PMFreakAocEvidenceRequirementHandoffBatchInput = {
  responses?: PMFreakAocGovernanceResponse[];
  inboxItems?: PMFreakAocDecisionInboxItem[];
  gateResults?: PMFreakAocGovernedActionGateResult[];
  displayModels?: PMFreakAocGateResultUIDisplayModel[];
  config?: Partial<PMFreakAocEvidenceRequirementHandoffConfig>;
};

// Builds a handoff package for each entry, in deterministic order:
// gateResults first, then inboxItems, then responses, then
// displayModels — each list processed via its own builder, in input
// array order. No AOC calls, no evidence attachment, no task creation,
// no input mutation.
export function batchCreatePMFreakAocEvidenceRequirementHandoffs(
  input: PMFreakAocEvidenceRequirementHandoffBatchInput,
): PMFreakAocEvidenceRequirementHandoffPackage[] {
  const handoffs: PMFreakAocEvidenceRequirementHandoffPackage[] = [];

  for (const gateResult of input.gateResults ?? []) {
    handoffs.push(createPMFreakAocEvidenceRequirementHandoffFromGateResult({ gateResult, config: input.config }));
  }

  for (const inboxItem of input.inboxItems ?? []) {
    handoffs.push(createPMFreakAocEvidenceRequirementHandoffFromDecisionInboxItem({ inboxItem, config: input.config }));
  }

  for (const response of input.responses ?? []) {
    handoffs.push(createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse({ response, config: input.config }));
  }

  for (const displayModel of input.displayModels ?? []) {
    handoffs.push(createPMFreakAocEvidenceRequirementHandoffFromGateResultUIDisplayModel({ displayModel, config: input.config }));
  }

  return handoffs;
}
