import test from "node:test";
import assert from "node:assert/strict";

import {
  createPMFreakAocGovernanceRequest,
  demoPMFreakAocBillingReadinessActionAttempt,
  PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("request builder creates a deterministic request ID from the action attempt ID", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();

  const requestA = createPMFreakAocGovernanceRequest({ actionAttempt });
  const requestB = createPMFreakAocGovernanceRequest({ actionAttempt });

  assert.equal(requestA.requestId, requestB.requestId);
  assert.equal(requestA.requestId, "pmfreak.aoc.request.demo.pmfreak.action-attempt.billing-readiness.v1.v1");
});

test("request builder preserves the pmfreak-consumes-aoc provider/consumer direction", () => {
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: demoPMFreakAocBillingReadinessActionAttempt() });

  assert.equal(request.providerId, "pmfreak");
  assert.equal(request.consumerOf, "aoc");
  assert.equal(request.clientId, PMFREAK_AOC_GOVERNANCE_REQUEST_CLIENT_ID);
});

test("request builder copies project context from the action attempt, with overrides applied", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt,
    projectContext: { phase: "execution", status: "on_track" },
  });

  assert.equal(request.projectContext.projectId, actionAttempt.projectId);
  assert.equal(request.projectContext.workspaceId, actionAttempt.workspaceId);
  assert.equal(request.projectContext.tenantId, actionAttempt.tenantId);
  assert.equal(request.projectContext.customerId, actionAttempt.customerId);
  assert.equal(request.projectContext.phase, "execution");
  assert.equal(request.projectContext.status, "on_track");
});

test("request builder copies agent and action context from the action attempt", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const request = createPMFreakAocGovernanceRequest({ actionAttempt });

  assert.equal(request.agentContext.agentId, actionAttempt.agentId);
  assert.equal(request.agentContext.agentRole, actionAttempt.agentRole);
  assert.equal(request.agentContext.passportId, actionAttempt.passportId);

  assert.equal(request.actionContext.actionId, actionAttempt.actionId);
  assert.equal(request.actionContext.actionCategory, actionAttempt.actionCategory);
  assert.equal(request.actionContext.actionTitle, actionAttempt.actionTitle);
  assert.equal(request.actionContext.targetMilestoneId, actionAttempt.targetMilestoneId);
  assert.deepEqual(request.actionContext.contextFlags, actionAttempt.contextFlags);
});

test("request builder copies evidence and approval context, merging provided/missing inputs", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt,
    providedEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.billing_review.v1"],
  });

  assert.deepEqual(request.evidenceContext.evidenceReferenceIds, actionAttempt.evidenceReferenceIds);
  assert.deepEqual(request.evidenceContext.providedEvidenceIds, ["demo.evidence.customer-acceptance.v1"]);
  assert.deepEqual(request.evidenceContext.missingEvidenceIds, []);

  assert.deepEqual(request.approvalContext.approvalReferenceIds, actionAttempt.approvalReferenceIds);
  assert.deepEqual(request.approvalContext.providedApprovalIds, []);
  assert.deepEqual(request.approvalContext.missingApprovalIds, ["demo.approval.billing_review.v1"]);
});

test("request builder never mutates the input action attempt", () => {
  const actionAttempt = demoPMFreakAocBillingReadinessActionAttempt();
  const snapshot = JSON.parse(JSON.stringify(actionAttempt));

  createPMFreakAocGovernanceRequest({
    actionAttempt,
    providedEvidenceIds: ["extra"],
    missingApprovalIds: ["extra-approval"],
  });

  assert.deepEqual(actionAttempt, snapshot);
});

test("request builder never mutates the input options object", () => {
  const input = {
    actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
    providedEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    missingEvidenceIds: [] as string[],
  };
  const snapshot = JSON.parse(JSON.stringify(input));

  const request = createPMFreakAocGovernanceRequest(input);
  request.evidenceContext.providedEvidenceIds.push("mutated-after-the-fact");

  assert.deepEqual(input, snapshot);
});
