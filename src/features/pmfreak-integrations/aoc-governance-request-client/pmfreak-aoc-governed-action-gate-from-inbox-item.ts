import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";
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

export type PMFreakAocGovernedActionGateFromDecisionInboxItemInput = {
  item: PMFreakAocDecisionInboxItem;
  config?: Partial<PMFreakAocGovernedActionGateConfig>;
  expectedRequestId?: string;
  expectedClientId?: string;
};

// Pure, deterministic evaluation: maps an already-normalized decision
// inbox item into a gate result. Lets the gate evaluate decisions that
// were already displayed by the decision inbox layer, without re-calling
// AOC or mutating the inbox item.
export function evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem(
  input: PMFreakAocGovernedActionGateFromDecisionInboxItemInput,
): PMFreakAocGovernedActionGateResult {
  const config = createPMFreakAocGovernedActionGateConfig(input.config);
  const { item } = input;

  const expectedRequestId = input.expectedRequestId;
  const expectedClientId = input.expectedClientId;

  const mismatchedRequestId = config.requireMatchingRequestId ? Boolean(expectedRequestId) && expectedRequestId !== item.requestId : false;
  const mismatchedClientId = config.requireMatchingClientId ? Boolean(expectedClientId) && expectedClientId !== item.clientId : false;
  const hasMismatch = mismatchedRequestId || mismatchedClientId;

  const verdict = hasMismatch ? "error" : mapPMFreakAocDecisionToGateVerdict(item.decision);
  const severity = mapPMFreakAocGateVerdictToSeverity(verdict);
  const flags = hasMismatch
    ? { canProceed: false, blocked: true, requiresEvidence: false, requiresApproval: false, requiresReview: false }
    : createPMFreakAocGateFlagsFromVerdict(verdict);

  const reasonCodes = createPMFreakAocGateReasonCodes({
    decision: item.decision,
    mismatchedRequestId,
    mismatchedClientId,
  });

  const candidateSafeSummary = hasMismatch
    ? "This gate result could not be safely evaluated because the expected request or client context did not match the decision inbox item."
    : item.safeSummary;
  const candidateSafeNextStep = hasMismatch ? createPMFreakAocGateSafeNextStep({ verdict }) : item.safeNextStep;

  const claimSafety = evaluatePMFreakAocGovernedActionGateClaimSafety({ safeSummary: candidateSafeSummary, safeNextStep: candidateSafeNextStep });
  const safeSummary = claimSafety.safe ? candidateSafeSummary : "This gate result summary was withheld because it failed a claim-safety check.";
  const safeNextStep = claimSafety.safe ? candidateSafeNextStep : "Review the gate errors before attempting a new request.";
  const finalReasonCodes = claimSafety.safe ? reasonCodes : [...reasonCodes, "unsafe_claim" as const];
  const finalErrors = claimSafety.safe ? [...item.errors] : [...item.errors, `Unsafe phrase(s) detected: ${claimSafety.unsafePhrases.join(", ")}`];

  const trace = createPMFreakAocGovernedActionGateTrace({
    verdict,
    decision: item.decision,
    mismatchedRequestId,
    mismatchedClientId,
    errors: finalErrors,
  });

  const gateResultId = buildPMFreakAocGovernedActionGateResultId(item.responseId ?? item.inboxItemId);

  return {
    gateResultId,
    gateId: PMFREAK_AOC_GOVERNED_ACTION_GATE_ID,

    inboxItemId: item.inboxItemId,
    requestId: item.requestId,
    responseId: item.responseId,
    clientId: item.clientId,

    agentId: item.agentId,
    agentRole: item.agentRole,
    projectId: item.projectId,
    workspaceId: item.workspaceId,
    tenantId: item.tenantId,
    customerId: item.customerId,
    actionId: item.actionId,
    actionCategory: item.actionCategory,
    actionTitle: item.actionTitle,

    aocDecision: item.decision,

    verdict,
    severity,

    canProceed: flags.canProceed,
    blocked: flags.blocked,
    requiresEvidence: flags.requiresEvidence,
    requiresApproval: flags.requiresApproval,
    requiresReview: flags.requiresReview,

    reasonCodes: finalReasonCodes,
    decisionReasonCodes: [...item.reasonCodes],

    safeSummary,
    safeNextStep,

    requiredEvidenceIds: [...item.requiredEvidenceIds],
    requiredApprovalIds: [...item.requiredApprovalIds],
    missingEvidenceIds: [...item.missingEvidenceIds],
    missingApprovalIds: [...item.missingApprovalIds],

    warnings: [...item.warnings],
    errors: finalErrors,
    safeLabels: [...new Set([...item.safeLabels, ...PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS])],

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
