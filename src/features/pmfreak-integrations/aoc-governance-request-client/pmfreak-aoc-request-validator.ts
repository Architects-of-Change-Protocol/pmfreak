import { evaluatePMFreakAocGovernanceClaimSafety } from "./pmfreak-aoc-claim-safety";
import { PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID } from "./pmfreak-aoc-governance-client-constants";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import { isPMFreakAocGovernanceClientForbiddenOperation } from "./pmfreak-aoc-no-mutation-guard";

export type PMFreakAocGovernanceRequestValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

// Pure validation: no AOC calls, no mutation, no side effects.
export function validatePMFreakAocGovernanceRequest(
  request: PMFreakAocGovernanceRequest,
): PMFreakAocGovernanceRequestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!request.requestId) {
    errors.push("requestId is required");
  }
  if (request.clientId !== PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID) {
    errors.push(`clientId must equal "${PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID}"`);
  }
  if (request.providerId !== "pmfreak") {
    errors.push('providerId must equal "pmfreak"');
  }
  if (request.consumerOf !== "aoc") {
    errors.push('consumerOf must equal "aoc"');
  }
  if (request.requestMode !== "dry_run" && request.requestMode !== "evaluate_only") {
    errors.push('requestMode must be "dry_run" or "evaluate_only"');
  }

  if (!request.actionAttempt) {
    errors.push("actionAttempt is required");
  } else {
    if (!request.actionAttempt.agentId) {
      errors.push("actionAttempt.agentId is required");
    }
    if (!request.actionAttempt.projectId) {
      errors.push("actionAttempt.projectId is required");
    }
    if (!request.actionAttempt.actionId) {
      errors.push("actionAttempt.actionId is required");
    }
    if (!request.actionAttempt.actionCategory) {
      errors.push("actionAttempt.actionCategory is required");
    }
  }

  if (!request.projectContext?.projectId) {
    errors.push("projectContext.projectId is required");
  }
  if (!request.actionContext?.actionId) {
    errors.push("actionContext.actionId is required");
  }

  const forbiddenContextFlags = (request.actionContext?.contextFlags ?? []).filter((flag) =>
    isPMFreakAocGovernanceClientForbiddenOperation(flag),
  );
  if (forbiddenContextFlags.length > 0) {
    errors.push(`request contextFlags include forbidden production operation(s): ${forbiddenContextFlags.join(", ")}`);
  }

  const claimSafety = evaluatePMFreakAocGovernanceClaimSafety(request);
  if (!claimSafety.safe) {
    errors.push(`request contains unsafe claim phrase(s): ${claimSafety.foundPhrases.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
