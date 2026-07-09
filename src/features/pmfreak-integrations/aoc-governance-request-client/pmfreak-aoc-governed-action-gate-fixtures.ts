import { demoPMFreakAocDecisionInboxDenyItem, demoPMFreakAocDecisionInboxHoldItem } from "./pmfreak-aoc-decision-inbox-fixtures";
import {
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingApprovalResponse,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocScheduleRequiresPmApprovalRequest,
  demoPMFreakAocScheduleRequiresPmApprovalResponse,
} from "./pmfreak-aoc-fixtures";
import { evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem } from "./pmfreak-aoc-governed-action-gate-from-inbox-item";
import { evaluatePMFreakAocGovernedActionGateFromGovernanceResponse } from "./pmfreak-aoc-governed-action-gate-from-response";
import { createPMFreakAocGovernedActionGateInput } from "./pmfreak-aoc-governed-action-gate-input";
import type { PMFreakAocGovernedActionGateInput } from "./pmfreak-aoc-governed-action-gate-input";
import type { PMFreakAocGovernedActionGateResult } from "./pmfreak-aoc-governed-action-gate-result";

// All identifiers below reuse existing fake/demo-only fixtures from
// pmfreak-aoc-fixtures.ts and pmfreak-aoc-decision-inbox-fixtures.ts: no
// real customer names, Datasys project IDs, emails, contract numbers,
// invoice numbers or secrets.

const MISMATCHED_REQUEST_ID = "demo.pmfreak.gate.mismatched-request-id.v1";
const MISMATCHED_CLIENT_ID = "demo.pmfreak.gate.mismatched-client-id.v1";

export async function demoPMFreakAocGovernedActionGatePassedResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  return evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateBlockedResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const item = await demoPMFreakAocDecisionInboxDenyItem();
  return evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
}

export async function demoPMFreakAocGovernedActionGateHeldResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const item = await demoPMFreakAocDecisionInboxHoldItem();
  return evaluatePMFreakAocGovernedActionGateFromDecisionInboxItem({ item });
}

export async function demoPMFreakAocGovernedActionGateNeedsEvidenceResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  return evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateNeedsApprovalResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const request = demoPMFreakAocScheduleRequiresPmApprovalRequest();
  const response = await demoPMFreakAocScheduleRequiresPmApprovalResponse();
  return evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateNeedsReviewResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const request = demoPMFreakAocBillingMissingApprovalRequest();
  const response = await demoPMFreakAocBillingMissingApprovalResponse();
  return evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateErrorResult(): Promise<PMFreakAocGovernedActionGateResult> {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  return evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({
    request,
    response,
    actionAttempt: request.actionAttempt,
    expectedRequestId: MISMATCHED_REQUEST_ID,
  });
}

export async function demoPMFreakAocGovernedActionGateAllowInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  return createPMFreakAocGovernedActionGateInput({ governanceRequest: request, governanceResponse: response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateDenyInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const item = await demoPMFreakAocDecisionInboxDenyItem();
  return createPMFreakAocGovernedActionGateInput({ decisionInboxItem: item });
}

export async function demoPMFreakAocGovernedActionGateHoldInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const item = await demoPMFreakAocDecisionInboxHoldItem();
  return createPMFreakAocGovernedActionGateInput({ decisionInboxItem: item });
}

export async function demoPMFreakAocGovernedActionGateRequireEvidenceInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  return createPMFreakAocGovernedActionGateInput({ governanceRequest: request, governanceResponse: response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateRequireBillingReviewInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const request = demoPMFreakAocBillingMissingApprovalRequest();
  const response = await demoPMFreakAocBillingMissingApprovalResponse();
  return createPMFreakAocGovernedActionGateInput({ governanceRequest: request, governanceResponse: response, actionAttempt: request.actionAttempt });
}

export async function demoPMFreakAocGovernedActionGateMismatchedRequestInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  return createPMFreakAocGovernedActionGateInput({
    governanceRequest: request,
    governanceResponse: response,
    actionAttempt: request.actionAttempt,
    expectedRequestId: MISMATCHED_REQUEST_ID,
  });
}

export async function demoPMFreakAocGovernedActionGateMismatchedClientInput(): Promise<PMFreakAocGovernedActionGateInput> {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  return createPMFreakAocGovernedActionGateInput({
    governanceRequest: request,
    governanceResponse: response,
    actionAttempt: request.actionAttempt,
    expectedClientId: MISMATCHED_CLIENT_ID,
  });
}

export async function demoPMFreakAocGovernedActionGateMixedResults(): Promise<PMFreakAocGovernedActionGateResult[]> {
  return Promise.all([
    demoPMFreakAocGovernedActionGatePassedResult(),
    demoPMFreakAocGovernedActionGateBlockedResult(),
    demoPMFreakAocGovernedActionGateHeldResult(),
    demoPMFreakAocGovernedActionGateNeedsEvidenceResult(),
    demoPMFreakAocGovernedActionGateNeedsApprovalResult(),
    demoPMFreakAocGovernedActionGateNeedsReviewResult(),
    demoPMFreakAocGovernedActionGateErrorResult(),
  ]);
}

export async function demoPMFreakAocGovernedActionGateAllPassedResults(): Promise<PMFreakAocGovernedActionGateResult[]> {
  const result = await demoPMFreakAocGovernedActionGatePassedResult();
  return [result, result, result];
}

export async function demoPMFreakAocGovernedActionGateAllBlockedResults(): Promise<PMFreakAocGovernedActionGateResult[]> {
  const result = await demoPMFreakAocGovernedActionGateBlockedResult();
  return [result, result, result];
}
