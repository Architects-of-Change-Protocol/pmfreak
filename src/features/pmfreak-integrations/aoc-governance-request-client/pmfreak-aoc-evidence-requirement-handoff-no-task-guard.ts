import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_TASK_FORBIDDEN_OPERATIONS,
} from "./pmfreak-aoc-evidence-requirement-handoff-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocEvidenceRequirementHandoffForbiddenTaskOperation(operationName: string): boolean {
  return (PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_TASK_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the handoff-only, non-task-creating surface of this feature.
// Every public handoff operation should route through here before doing
// any work.
export function assertPMFreakAocEvidenceRequirementHandoffDoesNotCreateTasks(operationName: string): void {
  if (isPMFreakAocEvidenceRequirementHandoffForbiddenTaskOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID}: PMFreak Evidence Requirement Handoff v1 is handoff-only and does not create tasks.`,
      { operationName },
    );
  }
}
