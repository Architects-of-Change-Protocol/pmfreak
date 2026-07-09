import { PMFREAK_AOC_GOVERNED_ACTION_GATE_EXECUTION_FORBIDDEN_OPERATIONS, PMFREAK_AOC_GOVERNED_ACTION_GATE_ID } from "./pmfreak-aoc-governed-action-gate-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocGovernedActionGateForbiddenExecutionOperation(operationName: string): boolean {
  return (PMFREAK_AOC_GOVERNED_ACTION_GATE_EXECUTION_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the gate-only, non-executing surface of this feature. Every
// public gate operation should route through here before doing any work.
export function assertPMFreakAocGovernedActionGateDoesNotExecute(operationName: string): void {
  if (isPMFreakAocGovernedActionGateForbiddenExecutionOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_GOVERNED_ACTION_GATE_ID}: PMFreak AOC Governed Action Gate v1 is gate-only and does not execute PMFreak actions.`,
      { operationName },
    );
  }
}
