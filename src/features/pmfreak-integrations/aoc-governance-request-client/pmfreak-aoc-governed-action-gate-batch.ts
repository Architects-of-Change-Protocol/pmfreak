import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateConfig } from "./pmfreak-aoc-governed-action-gate-config";
import { evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem } from "./pmfreak-aoc-governed-action-gate-from-inbox-item";
import { evaluatePMFreakAocGovernedActionGateFromGovernanceResponse } from "./pmfreak-aoc-governed-action-gate-from-response";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";

export type PMFreakAocGovernedActionGateBatchInput = {
  responses?: PMFreakAocGovernanceResponse[];
  inboxItems?: PMFreakAocDecisionInboxItem[];
  config?: Partial<PMFreakAocGovernedActionGateConfig>;
};

// Evaluates each response then each inbox item, preserving input array
// order. Does not mutate any input, does not execute actions, and does
// not call AOC.
export function batchEvaluatePMFreakAocGovernedActionGateResults(
  input: PMFreakAocGovernedActionGateBatchInput,
): PMFreakAocGovernedActionGateResult[] {
  const results: PMFreakAocGovernedActionGateResult[] = [];

  for (const response of input.responses ?? []) {
    results.push(evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ response, config: input.config }));
  }

  for (const item of input.inboxItems ?? []) {
    results.push(evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item, config: input.config }));
  }

  return results;
}
