import type { PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceRequestBuilderInput } from "./pmfreak-aoc-request-builder";
import type { PMFreakAocGovernanceRequestClient } from "./pmfreak-aoc-governance-client";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import { PMFREAK_AOC_GOVERNED_ACTION_GATE_ID, PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS } from "./pmfreak-aoc-governed-action-gate-constants";
import type { PMFreakAocGovernedActionGateConfig } from "./pmfreak-aoc-governed-action-gate-config";
import { evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem } from "./pmfreak-aoc-governed-action-gate-from-inbox-item";
import { evaluatePMFreakAocGovernedActionGateFromGovernanceResponse } from "./pmfreak-aoc-governed-action-gate-from-response";
import type { PMFreakAocGovernedActionGateInput } from "./pmfreak-aoc-governed-action-gate-input";
import { createPMFreakAocGateFlagsFromVerdict } from "./pmfreak-aoc-governed-action-gate-policy";
import { createPMFreakAocGateReasonCodes } from "./pmfreak-aoc-governed-action-gate-reason";
import { createPMFreakAocGateSafeNextStep } from "./pmfreak-aoc-governed-action-gate-next-step";
import { buildPMFreakAocGovernedActionGateResultId } from "./pmfreak-aoc-governed-action-gate-result";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";
import { createPMFreakAocGovernedActionGateTrace } from "./pmfreak-aoc-governed-action-gate-trace";
import { mapPMFreakAocGateVerdictToSeverity } from "./pmfreak-aoc-governed-action-gate-verdict";

// A safe, deterministic error gate result for when neither a governance
// response nor a decision inbox item was provided on the gate input.
function createPMFreakAocGovernedActionGateMissingInputResult(gateInput: PMFreakAocGovernedActionGateInput): PMFreakAocGovernedActionGateResult {
  const verdict = "error" as const;
  const severity = mapPMFreakAocGateVerdictToSeverity(verdict);
  const flags = createPMFreakAocGateFlagsFromVerdict(verdict);
  const reasonCodes = createPMFreakAocGateReasonCodes({ decision: undefined, validationErrors: gateInput.errors });
  const safeNextStep = createPMFreakAocGateSafeNextStep({ verdict });
  const errors = [...gateInput.errors, "No governance response or decision inbox item was provided to the gate."];
  const trace = createPMFreakAocGovernedActionGateTrace({ verdict, errors });

  return {
    gateResultId: buildPMFreakAocGovernedActionGateResultId(gateInput.gateInputId),
    gateId: PMFREAK_AOC_GOVERNED_ACTION_GATE_ID,

    gateInputId: gateInput.gateInputId,

    actionAttemptId: gateInput.actionAttempt?.actionAttemptId,
    agentId: gateInput.actionAttempt?.agentId,
    agentRole: gateInput.actionAttempt?.agentRole,
    projectId: gateInput.actionAttempt?.projectId,
    workspaceId: gateInput.actionAttempt?.workspaceId,
    tenantId: gateInput.actionAttempt?.tenantId,
    customerId: gateInput.actionAttempt?.customerId,
    actionId: gateInput.actionAttempt?.actionId,
    actionCategory: gateInput.actionAttempt?.actionCategory,
    actionTitle: gateInput.actionAttempt?.actionTitle,

    verdict,
    severity,

    canProceed: flags.canProceed,
    blocked: flags.blocked,
    requiresEvidence: flags.requiresEvidence,
    requiresApproval: flags.requiresApproval,
    requiresReview: flags.requiresReview,

    reasonCodes,
    decisionReasonCodes: [],

    safeSummary: "This gate could not safely evaluate this action because no governance response or decision inbox item was provided.",
    safeNextStep,

    requiredEvidenceIds: [],
    requiredApprovalIds: [],
    missingEvidenceIds: [],
    missingApprovalIds: [],

    warnings: [...gateInput.warnings],
    errors,
    safeLabels: [...PMFREAK_AOC_GOVERNED_ACTION_GATE_SAFE_LABELS],

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

export type PMFreakAocGovernedActionGateEvaluationInput = {
  gateInput: PMFreakAocGovernedActionGateInput;
  config?: Partial<PMFreakAocGovernedActionGateConfig>;
};

// Main dispatcher: prefers an attached governance response, falls back to
// a decision inbox item, and otherwise returns a safe error gate result.
// Never calls AOC directly, never executes the action, never mutates
// state.
export async function evaluatePMFreakAocGovernedActionGate(
  input: PMFreakAocGovernedActionGateEvaluationInput,
): Promise<PMFreakAocGovernedActionGateResult> {
  const { gateInput, config } = input;

  if (gateInput.governanceResponse) {
    return evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({
      response: gateInput.governanceResponse,
      request: gateInput.governanceRequest,
      actionAttempt: gateInput.actionAttempt,
      config,
      expectedRequestId: gateInput.expectedRequestId,
      expectedClientId: gateInput.expectedClientId,
    });
  }

  if (gateInput.decisionInboxItem) {
    return evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({
      item: gateInput.decisionInboxItem,
      config,
      expectedRequestId: gateInput.expectedRequestId,
      expectedClientId: gateInput.expectedClientId,
    });
  }

  return createPMFreakAocGovernedActionGateMissingInputResult(gateInput);
}

export type PMFreakAocGovernedActionAttemptGateInput = {
  actionAttempt: PMFreakAocAgentActionAttempt;
  governanceClient: PMFreakAocGovernanceRequestClient;
  requestInput?: Omit<PMFreakAocGovernanceRequestBuilderInput, "actionAttempt">;
  gateConfig?: Partial<PMFreakAocGovernedActionGateConfig>;
};

export type PMFreakAocGovernedActionAttemptGateResult = {
  request: PMFreakAocGovernanceRequest;
  response: PMFreakAocGovernanceResponse;
  gateResult: PMFreakAocGovernedActionGateResult;
};

// Builds and evaluates a governance request using the existing,
// already-non-mutating governance request client, then evaluates the gate
// result from the returned response. Does not create a new governance
// client or transport, does not execute the action, does not mutate
// PMFreak data and does not write back a decision.
export async function evaluatePMFreakAocGovernedActionAttemptGate(
  input: PMFreakAocGovernedActionAttemptGateInput,
): Promise<PMFreakAocGovernedActionAttemptGateResult> {
  const { actionAttempt, governanceClient, requestInput, gateConfig } = input;

  const request = governanceClient.buildRequest({ ...(requestInput ?? {}), actionAttempt });
  const response = await governanceClient.evaluateRequest(request);

  const gateResult = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({
    response,
    request,
    actionAttempt,
    config: gateConfig,
  });

  return { request, response, gateResult };
}
