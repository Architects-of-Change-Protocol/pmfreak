import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_COMMUNICATION_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
} from "./pmfreak-aoc-evidence-requirement-handoff-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocEvidenceRequirementHandoffForbiddenCommunicationOperation(operationName: string): boolean {
  return (PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_COMMUNICATION_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the handoff-only, non-communicating surface of this feature.
// Every public handoff operation should route through here before doing
// any work.
export function assertPMFreakAocEvidenceRequirementHandoffDoesNotCommunicate(operationName: string): void {
  if (isPMFreakAocEvidenceRequirementHandoffForbiddenCommunicationOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID}: PMFreak Evidence Requirement Handoff v1 is handoff-only and does not send communications.`,
      { operationName },
    );
  }
}
