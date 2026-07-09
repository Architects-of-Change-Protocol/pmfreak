import { PMFREAK_AOC_GATE_RESULT_UI_ACTION_FORBIDDEN_OPERATIONS, PMFREAK_AOC_GATE_RESULT_UI_ID } from "./pmfreak-aoc-gate-result-ui-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocGateResultUIForbiddenActionOperation(operationName: string): boolean {
  return (PMFREAK_AOC_GATE_RESULT_UI_ACTION_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the presentation-only, non-executing surface of this feature.
// Every public gate result UI operation should route through here before
// doing any work.
export function assertPMFreakAocGateResultUIDoesNotAct(operationName: string): void {
  if (isPMFreakAocGateResultUIForbiddenActionOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_GATE_RESULT_UI_ID}: PMFreak AOC Gate Result UI v1 is presentation-only and does not execute PMFreak actions.`,
      { operationName },
    );
  }
}
