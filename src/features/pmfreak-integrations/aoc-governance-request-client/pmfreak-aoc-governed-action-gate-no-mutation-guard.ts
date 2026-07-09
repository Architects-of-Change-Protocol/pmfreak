import { PMFREAK_AOC_GOVERNED_ACTION_GATE_ID, PMFREAK_AOC_GOVERNED_ACTION_GATE_MUTATION_FORBIDDEN_OPERATIONS } from "./pmfreak-aoc-governed-action-gate-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocGovernedActionGateForbiddenMutationOperation(operationName: string): boolean {
  return (PMFREAK_AOC_GOVERNED_ACTION_GATE_MUTATION_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the gate-only, non-mutating surface of this feature. Every
// public gate operation should route through here before doing any work.
export function assertPMFreakAocGovernedActionGateDoesNotMutate(operationName: string): void {
  if (isPMFreakAocGovernedActionGateForbiddenMutationOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_GOVERNED_ACTION_GATE_ID}: PMFreak AOC Governed Action Gate v1 is gate-only and does not mutate PMFreak data.`,
      { operationName },
    );
  }
}
