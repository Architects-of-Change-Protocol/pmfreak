import type { PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import { PMFREAK_AOC_GOVERNED_ACTION_GATE_ID, PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS } from "./pmfreak-aoc-governed-action-gate-constants";
import { createPMFreakAocGovernedActionGateConfig } from "./pmfreak-aoc-governed-action-gate-config";
import type { PMFreakAocGovernedActionGateConfig } from "./pmfreak-aoc-governed-action-gate-config";
import { evaluatePMFreakAocGovernedActionGateClaimSafety } from "./pmfreak-aoc-governed-action-gate-claim-safety";
import { createPMFreakAocGateFlagsFromVerdict } from "./pmfreak-aoc-governed-action-gate-policy";
import { createPMFreakAocGateReasonCodes } from "./pmfreak-aoc-governed-action-gate-reason";
import { createPMFreakAocGateSafeNextStep } from "./pmfreak-aoc-governed-action-gate-next-step";
import { buildPMFreakAocGovernedActionGateResultId } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import { createPMFreakAocGovernedActionGateTrace } from "./pmfreak-aoc-governed-action-gate-trace";
import { mapPMFreakAocDecisionToGateVerdict, mapPMFreakAocGateVerdictToSeverity } from "./pmfreak-aoc-governed-action-gate-verdict";

export type PMFreakAocGovernedActionGateFromGovernanceResponseInput = {
  response: PMFreakAocGovernanceResponse;
  request?: PMFreakAocGovernanceRequest;
  actionAttempt?: PMFreakAocAgentActionAttempt;
  config?: Partial<PMFreakAocGovernedActionGateConfig>;
  expectedRequestId?: string;
  expectedClientId?: string;
};

// Pure, deterministic evaluation: maps an already-received AOC governance
// response (optionally paired with the request/action attempt that
// produced it) into a gate result. Does not mutate its inputs, does not
// call AOC, does not execute the action and does not write back.
export function evaluatePMFreakAocGovernedActionGateFromGovernanceResponse(
  input: PMFreakAocGovernedActionGateFromGovernanceResponseInput,
): PMFreakAocGovernedActionGateResult {
  const config = createPMFreakAocGovernedActionGateConfig(input.config);
  const { response, request, actionAttempt } = input;

  const expectedRequestId = input.expectedRequestId ?? request?.requestId;
  const expectedClientId = input.expectedClientId ?? request?.clientId;

  const mismatchedRequestId = config.requireMatchingRequestId ? Boolean(expectedRequestId) && expectedRequestId !== response.requestId : false;
  const mismatchedClientId = config.requireMatchingClientId ? Boolean(expectedClientId) && expectedClientId !== response.clientId : false;
  const hasMismatch = mismatchedRequestId || mismatchedClientId;

  const verdict = hasMismatch ? "error" : mapPMFreakAocDecisionToGateVerdict(response.decision);
  const severity = mapPMFreakAocGateVerdictToSeverity(verdict);
  const flags = hasMismatch
    ? { canProceed: false, blocked: true, requiresEvidence: false, requiresApproval: false, requiresReview: false }
    : createPMFreakAocGateFlagsFromVerdict(verdict);

  const reasonCodes = createPMFreakAocGateReasonCodes({
    decision: response.decision,
    mismatchedRequestId,
    mismatchedClientId,
  });

  const candidateSafeSummary = hasMismatch
    ? "This gate result could not be safely evaluated because the expected request or client context did not match the governance response."
    : response.safeSummary;

  const candidateSafeNextStep = hasMismatch
    ? createPMFreakAocGateSafeNextStep({ verdict })
    : createPMFreakAocGateSafeNextStep({
        verdict,
        decision: response.decision,
        requiredEvidenceIds: response.requiredEvidenceIds,
        requiredApprovalIds: response.requiredApprovalIds,
        missingEvidenceIds: response.missingEvidenceIds,
        missingApprovalIds: response.missingApprovalIds,
      });

  const claimSafety = evaluatePMFreakAocGovernedActionGateClaimSafety({ safeSummary: candidateSafeSummary, safeNextStep: candidateSafeNextStep });
  const safeSummary = claimSafety.safe ? candidateSafeSummary : "This gate result summary was withheld because it failed a claim-safety check.";
  const safeNextStep = claimSafety.safe ? candidateSafeNextStep : "Review the gate errors before attempting a new request.";
  const finalReasonCodes = claimSafety.safe ? reasonCodes : [...reasonCodes, "unsafe_claim" as const];
  const finalErrors = claimSafety.safe
    ? [...response.errors]
    : [...response.errors, `Unsafe phrase(s) detected: ${claimSafety.unsafePhrases.join(", ")}`];

  const trace = createPMFreakAocGovernedActionGateTrace({
    verdict,
    decision: response.decision,
    response,
    mismatchedRequestId,
    mismatchedClientId,
    errors: finalErrors,
  });

  const gateResultId = buildPMFreakAocGovernedActionGateResultId(response.responseId);

  return {
    gateResultId,
    gateId: PMFREAK_AOC_GOVERNED_ACTION_GATE_ID,

    requestId: response.requestId,
    responseId: response.responseId,
    clientId: response.clientId,

    actionAttemptId: actionAttempt?.actionAttemptId,
    agentId: request?.agentContext.agentId ?? actionAttempt?.agentId,
    agentRole: request?.agentContext.agentRole ?? actionAttempt?.agentRole,
    projectId: request?.projectContext.projectId ?? actionAttempt?.projectId,
    workspaceId: request?.projectContext.workspaceId ?? actionAttempt?.workspaceId,
    tenantId: request?.projectContext.tenantId ?? actionAttempt?.tenantId,
    customerId: request?.projectContext.customerId ?? actionAttempt?.customerId,
    actionId: request?.actionContext.actionId ?? actionAttempt?.actionId,
    actionCategory: request?.actionContext.actionCategory ?? actionAttempt?.actionCategory,
    actionTitle: request?.actionContext.actionTitle ?? actionAttempt?.actionTitle,

    aocDecision: response.decision,

    verdict,
    severity,

    canProceed: flags.canProceed,
    blocked: flags.blocked,
    requiresEvidence: flags.requiresEvidence,
    requiresApproval: flags.requiresApproval,
    requiresReview: flags.requiresReview,

    reasonCodes: finalReasonCodes,
    decisionReasonCodes: [...response.reasonCodes],

    safeSummary,
    safeNextStep,

    requiredEvidenceIds: [...response.requiredEvidenceIds],
    requiredApprovalIds: [...response.requiredApprovalIds],
    missingEvidenceIds: [...response.missingEvidenceIds],
    missingApprovalIds: [...response.missingApprovalIds],

    warnings: [...response.warnings],
    errors: finalErrors,
    safeLabels: [...new Set([...response.safeLabels, ...PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS])],

    trace,

    gateOnly: true,
    actionExecutionCapable: false,
    mutationCapable: false,
    writebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    legalCertificationCapable: false,
    complianceCertificationCapable: false,
  };
}
