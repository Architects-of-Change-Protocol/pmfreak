import { PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID, PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS } from "./pmfreak-aoc-decision-inbox-constants";
import { PMFreakAocGovernanceClientError } from "./pmfreak-aoc-errors";

export function isPMFreakAocDecisionInboxForbiddenOperation(operationName: string): boolean {
  return (PMFREAK_AOC_DECISION_INBOX_FORBIDDEN_OPERATIONS as readonly string[]).includes(operationName);
}

// Guards the read-only, display-oriented surface of this feature. Every
// public inbox operation should route through here before doing any work.
// Reuses the base module's typed, safe error class/codes.
export function assertPMFreakAocDecisionInboxDisplayOnlyOperation(operationName: string): void {
  if (isPMFreakAocDecisionInboxForbiddenOperation(operationName)) {
    throw new PMFreakAocGovernanceClientError(
      "mutation_not_allowed",
      `Operation "${operationName}" is forbidden for ${PMFREAK_AOC_DECISION_DISPLAY_INBOX_ID}: PMFreak AOC Decision Display / Inbox v1 is display-only and non-enforcing.`,
      { operationName },
    );
  }
}
