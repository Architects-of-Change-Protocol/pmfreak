import test from "node:test";
import assert from "node:assert/strict";

import {
  createLocalMockPMFreakAocGovernanceTransport,
  createPMFreakAocGovernanceRequestClientConfig,
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingApprovalResponse,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocClientCommunicationRequiresApprovalRequest,
  demoPMFreakAocClientCommunicationRequiresApprovalResponse,
  demoPMFreakAocRiskEscalationActionAttempt,
  demoPMFreakAocScheduleRequiresPmApprovalRequest,
  demoPMFreakAocScheduleRequiresPmApprovalResponse,
  evaluatePMFreakAocGovernedActionGateFromGovernanceResponse,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

async function evaluateForcedDecision(request: ReturnType<typeof demoPMFreakAocBillingAllowedRequest>, forcedDecision: string) {
  const transport = createLocalMockPMFreakAocGovernanceTransport({ forcedDecision: forcedDecision as never });
  const config = createPMFreakAocGovernanceRequestClientConfig();
  return transport.evaluateGovernanceRequest(request, config);
}

test("evaluator maps allow response to passed gate result", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "passed");
  assert.equal(result.canProceed, true);
});

test("evaluator maps deny response to blocked gate result", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await evaluateForcedDecision(request, "deny");
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "blocked");
  assert.equal(result.canProceed, false);
});

test("evaluator maps hold response to held gate result", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await evaluateForcedDecision(request, "hold");
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "held");
});

test("evaluator maps require_evidence response to needs_evidence gate result", async () => {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response, actionAttempt: request.actionAttempt });
  assert.equal(result.verdict, "needs_evidence");
  assert.equal(result.requiresEvidence, true);
});

test("evaluator maps require_pm_approval response to needs_approval gate result", async () => {
  const request = demoPMFreakAocScheduleRequiresPmApprovalRequest();
  const response = await demoPMFreakAocScheduleRequiresPmApprovalResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "needs_approval");
  assert.equal(result.requiresApproval, true);
});

test("evaluator maps require_customer_validation response to needs_review gate result", async () => {
  const request = demoPMFreakAocClientCommunicationRequiresApprovalRequest();
  const response = await demoPMFreakAocClientCommunicationRequiresApprovalResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "needs_review");
});

test("evaluator maps require_billing_review response to needs_review gate result", async () => {
  const request = demoPMFreakAocBillingMissingApprovalRequest();
  const response = await demoPMFreakAocBillingMissingApprovalResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "needs_review");
});

test("evaluator maps require_contract_review response to needs_review gate result", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await evaluateForcedDecision(request, "require_contract_review");
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "needs_review");
});

test("evaluator maps require_security_review response to needs_review gate result", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await evaluateForcedDecision(request, "require_security_review");
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "needs_review");
});

test("evaluator maps require_executive_approval response to needs_approval gate result", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await evaluateForcedDecision(request, "require_executive_approval");
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.verdict, "needs_approval");
});

test("evaluator preserves requestId, responseId and clientId", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.requestId, response.requestId);
  assert.equal(result.responseId, response.responseId);
  assert.equal(result.clientId, response.clientId);
});

test("evaluator preserves project/action context when a request is provided", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.projectId, request.projectContext.projectId);
  assert.equal(result.agentId, request.agentContext.agentId);
  assert.equal(result.actionId, request.actionContext.actionId);
  assert.equal(result.actionTitle, request.actionContext.actionTitle);
});

test("evaluator preserves project/action context when an action attempt is provided without a request", async () => {
  const actionAttempt = demoPMFreakAocRiskEscalationActionAttempt();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ response, actionAttempt });
  assert.equal(result.actionAttemptId, actionAttempt.actionAttemptId);
  assert.equal(result.agentId, actionAttempt.agentId);
  assert.equal(result.projectId, actionAttempt.projectId);
});

test("evaluator preserves required and missing evidence/approval IDs", async () => {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.deepEqual(result.requiredEvidenceIds, response.requiredEvidenceIds);
  assert.deepEqual(result.requiredApprovalIds, response.requiredApprovalIds);
  assert.deepEqual(result.missingEvidenceIds, response.missingEvidenceIds);
  assert.deepEqual(result.missingApprovalIds, response.missingApprovalIds);
});

test("evaluator preserves decision reason codes", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.deepEqual(result.decisionReasonCodes, response.reasonCodes);
});

test("evaluator creates a gate trace", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.ok(Array.isArray(result.trace));
  assert.ok(result.trace.length > 0);
});

test("evaluator rejects a mismatched requestId safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({
    request,
    response,
    expectedRequestId: "demo.pmfreak.gate.mismatched-request-id.v1",
  });
  assert.equal(result.verdict, "error");
  assert.equal(result.canProceed, false);
  assert.equal(result.blocked, true);
  assert.ok(result.reasonCodes.includes("mismatched_request_id"));
});

test("evaluator rejects a mismatched clientId safely", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({
    request,
    response,
    expectedClientId: "demo.pmfreak.gate.mismatched-client-id.v1",
  });
  assert.equal(result.verdict, "error");
  assert.equal(result.canProceed, false);
  assert.equal(result.blocked, true);
  assert.ok(result.reasonCodes.includes("mismatched_client_id"));
});

test("evaluator does not mutate its inputs", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const requestSnapshot = structuredClone(request);
  const responseSnapshot = structuredClone(response);
  evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.deepEqual(request, requestSnapshot);
  assert.deepEqual(response, responseSnapshot);
});

test("evaluator forces gate-only and non-executing capability flags", async () => {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  const result = evaluatePMFreakAocGovernedActionGateFromGovernanceResponse({ request, response });
  assert.equal(result.gateOnly, true);
  assert.equal(result.actionExecutionCapable, false);
  assert.equal(result.mutationCapable, false);
  assert.equal(result.writebackCapable, false);
});
