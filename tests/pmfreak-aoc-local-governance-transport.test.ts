import test from "node:test";
import assert from "node:assert/strict";

import {
  createLocalMockPMFreakAocGovernanceTransport,
  createPMFreakAocGovernanceRequest,
  createPMFreakAocGovernanceRequestClientConfig,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocChangeControlActionAttempt,
  demoPMFreakAocClientCommunicationRequiresApprovalRequest,
  demoPMFreakAocEvidenceActionAttempt,
  demoPMFreakAocRiskEscalationActionAttempt,
  demoPMFreakAocRiskEscalationAllowedRequest,
  demoPMFreakAocScheduleRequiresPmApprovalRequest,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const config = createPMFreakAocGovernanceRequestClientConfig();

test("local mock transport is explicitly labeled local_mock / local_mock_aoc, not production AOC", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  assert.equal(transport.transportKind, "local_mock");

  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocRiskEscalationAllowedRequest(), config);
  assert.equal(response.evaluatedBy, "local_mock_aoc");
  assert.ok(response.disclaimers.some((line) => /not production AOC/i.test(line)));
});

test("returns require_evidence for a billing action missing evidence", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocBillingMissingEvidenceRequest(), config);
  assert.equal(response.decision, "require_evidence");
});

test("returns require_billing_review for a billing action missing a billing review approval", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocBillingMissingApprovalRequest(), config);
  assert.equal(response.decision, "require_billing_review");
});

test("returns allow when evidence and approvals are complete", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocRiskEscalationAllowedRequest(), config);
  assert.equal(response.decision, "allow");
  assert.equal(response.decisionSeverity, "success");
});

test("returns require_evidence for a non-billing action missing evidence", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocEvidenceActionAttempt(),
    missingEvidenceIds: ["demo.evidence.supporting-doc.v1"],
  });
  const response = await transport.evaluateGovernanceRequest(request, config);
  assert.equal(response.decision, "require_evidence");
});

test("returns require_pm_approval when a pm_approval approval is missing", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocScheduleRequiresPmApprovalRequest(), config);
  assert.equal(response.decision, "require_pm_approval");
});

test("returns require_customer_validation when a customer_validation approval is missing", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const response = await transport.evaluateGovernanceRequest(
    demoPMFreakAocClientCommunicationRequiresApprovalRequest(),
    config,
  );
  assert.equal(response.decision, "require_customer_validation");
});

test("returns require_contract_review when a contract_review approval is missing", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocChangeControlActionAttempt(),
    missingApprovalIds: ["demo.approval.contract_review.v1"],
  });
  const response = await transport.evaluateGovernanceRequest(request, config);
  assert.equal(response.decision, "require_contract_review");
});

test("returns require_security_review when a security_review approval is missing", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocRiskEscalationActionAttempt(),
    missingApprovalIds: ["demo.approval.security_review.v1"],
  });
  const response = await transport.evaluateGovernanceRequest(request, config);
  assert.equal(response.decision, "require_security_review");
});

test("returns require_executive_approval when an executive_approval approval is missing", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocRiskEscalationActionAttempt(),
    missingApprovalIds: ["demo.approval.executive_approval.v1"],
  });
  const response = await transport.evaluateGovernanceRequest(request, config);
  assert.equal(response.decision, "require_executive_approval");
});

test("returns deny for a cancelled action attempt", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const cancelledAttempt = { ...demoPMFreakAocBillingReadinessActionAttempt(), status: "cancelled" as const };
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: cancelledAttempt });

  const response = await transport.evaluateGovernanceRequest(request, config);
  assert.equal(response.decision, "deny");
  assert.equal(response.decisionSeverity, "danger");
});

test("forcedDecision option overrides the computed decision deterministically", async () => {
  const transport = createLocalMockPMFreakAocGovernanceTransport({ forcedDecision: "hold" });
  const response = await transport.evaluateGovernanceRequest(demoPMFreakAocRiskEscalationAllowedRequest(), config);
  assert.equal(response.decision, "hold");
});

test("responseMap option merges per-request overrides", async () => {
  const request = demoPMFreakAocRiskEscalationAllowedRequest();
  const transport = createLocalMockPMFreakAocGovernanceTransport({
    responseMap: { [request.requestId]: { safeSummary: "Overridden safe summary." } },
  });
  const response = await transport.evaluateGovernanceRequest(request, config);
  assert.equal(response.safeSummary, "Overridden safe summary.");
  assert.equal(response.decision, "allow");
});
