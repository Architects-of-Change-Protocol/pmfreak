import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ATTACHMENT_FORBIDDEN_OPERATIONS,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
} from "./pmfreak-aoc-evidence-requirement-handoff-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocEvidenceRequirementHandoffForbiddenAttachmentOperation(operationName: string): boolean {
  return (PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ATTACHMENT_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the handoff-only, non-attaching surface of this feature. Every
// public handoff operation should route through here before doing any
// work.
export function assertPMFreakAocEvidenceRequirementHandoffDoesNotAttachEvidence(operationName: string): void {
  if (isPMFreakAocEvidenceRequirementHandoffForbiddenAttachmentOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID}: PMFreak Evidence Requirement Handoff v1 is handoff-only and does not attach evidence.`,
      { operationName },
    );
  }
}
