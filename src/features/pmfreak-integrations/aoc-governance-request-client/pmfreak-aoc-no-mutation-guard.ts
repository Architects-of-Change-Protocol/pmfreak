import { PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS, PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID } from "./pmfreak-aoc-governance-client-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocGovernanceClientForbiddenOperation(operationName: string): boolean {
  return (PMFREAK_AOC_GOVERNANCE_CLIENT_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the read-only, request-oriented surface of this client. Every
// public client operation should route through here before doing any work.
export function assertPMFreakAocGovernanceClientReadOnlyOperation(operationName: string): void {
  if (isPMFreakAocGovernanceClientForbiddenOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID}: PMFreak AOC Governance Request Client v1 is non-mutating and non-enforcing in v1.`,
      { operationName },
    );
  }
}
