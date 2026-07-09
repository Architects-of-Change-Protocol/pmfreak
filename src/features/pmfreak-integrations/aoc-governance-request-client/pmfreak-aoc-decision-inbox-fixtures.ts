import type { PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import { createPMFreakAocDecisionInboxItemFromGovernanceResponse } from "./pmfreak-aoc-decision-inbox-normalizer";
import type { PMFreakAocDecisionInboxItem } from "./pmfreak-aoc-decision-inbox-types";
import {
  demoPMFreakAocBillingAllowedRequest,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingApprovalRequest,
  demoPMFreakAocBillingMissingApprovalResponse,
  demoPMFreakAocBillingMissingEvidenceRequest,
  demoPMFreakAocBillingMissingEvidenceResponse,
  demoPMFreakAocBillingReadinessActionAttempt,
  demoPMFreakAocChangeControlActionAttempt,
  demoPMFreakAocClientCommunicationRequiresApprovalRequest,
  demoPMFreakAocClientCommunicationRequiresApprovalResponse,
  demoPMFreakAocRiskEscalationActionAttempt,
  demoPMFreakAocScheduleRequiresPmApprovalRequest,
  demoPMFreakAocScheduleRequiresPmApprovalResponse,
} from "./pmfreak-aoc-fixtures";
import { createPMFreakAocGovernanceRequestClientConfig } from "./pmfreak-aoc-governance-client-config";
import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import { createLocalMockPMFreakAocGovernanceTransport } from "./pmfreak-aoc-local-governance-transport";
import { createPMFreakAocGovernanceRequest } from "./pmfreak-aoc-request-builder";

// All identifiers below are fake and demo-only: no real customer names,
// Datasys project IDs, emails, contract numbers or invoice numbers.

const FIXED_CREATED_AT_LABEL = "2026-01-01T00:00:00.000Z";

async function evaluate(request: PMFreakAocGovernanceRequest, forcedDecision?: PMFreakAocGovernanceDecision) {
  const transport = createLocalMockPMFreakAocGovernanceTransport(forcedDecision ? { forcedDecision } : undefined);
  const config = createPMFreakAocGovernanceRequestClientConfig();
  return transport.evaluateGovernanceRequest(request, config);
}

function demoPMFreakAocSecurityReviewActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.security-review.v1",
    agentId: "demo.agent.risk.v1",
    agentRole: "risk_agent",
    passportId: "demo.passport.risk.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.security-review.v1",
    actionCategory: "risk",
    actionTitle: "Request security review for a risk mitigation",
    actionDescription: "Risk Agent wants a security review before mitigating a project risk.",
    targetRiskId: "demo.risk.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["security_sensitive"],
    evidenceReferenceIds: [],
    approvalReferenceIds: ["demo.approval.security_review.v1"],
    sourceUpdatedAt: FIXED_CREATED_AT_LABEL,
    metadata: {},
  };
}

function demoPMFreakAocExecutiveApprovalActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.executive-approval.v1",
    agentId: "demo.agent.change-control.v1",
    agentRole: "change_control_agent",
    passportId: "demo.passport.change-control.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.approve-major-change.v1",
    actionCategory: "project_governance",
    actionTitle: "Approve a major scope change",
    actionDescription: "Change Control Agent wants executive approval for a major scope change.",
    targetChangeRequestId: "demo.change-request.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["executive_sensitive"],
    evidenceReferenceIds: [],
    approvalReferenceIds: ["demo.approval.executive_approval.v1"],
    sourceUpdatedAt: FIXED_CREATED_AT_LABEL,
    metadata: {},
  };
}

async function normalizeFixture(request: PMFreakAocGovernanceRequest, forcedDecision?: PMFreakAocGovernanceDecision): Promise<PMFreakAocDecisionInboxItem> {
  const response = await evaluate(request, forcedDecision);
  return createPMFreakAocDecisionInboxItemFromGovernanceResponse({
    request,
    response,
    source: "local_mock",
    createdAtLabel: FIXED_CREATED_AT_LABEL,
  });
}

export async function demoPMFreakAocDecisionInboxAllowItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = demoPMFreakAocBillingAllowedRequest();
  const response = await demoPMFreakAocBillingAllowedResponse();
  return createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response, source: "local_mock", createdAtLabel: FIXED_CREATED_AT_LABEL });
}

// Uses a risk-related action attempt so this fixture also exercises the
// "deny + risk-related action -> risk" category rule.
export async function demoPMFreakAocDecisionInboxDenyItem(): Promise<PMFreakAocDecisionInboxItem> {
  const cancelledAttempt: PMFreakAocAgentActionAttempt = {
    ...demoPMFreakAocRiskEscalationActionAttempt(),
    status: "cancelled",
  };
  const request = createPMFreakAocGovernanceRequest({ actionAttempt: cancelledAttempt });
  return normalizeFixture(request);
}

// The local/mock transport never returns "hold" on its own, so this
// fixture forces it via `forcedDecision`. Uses a communication action
// attempt so this fixture also exercises the
// "hold + communication action -> communication" category rule.
export async function demoPMFreakAocDecisionInboxHoldItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = demoPMFreakAocClientCommunicationRequiresApprovalRequest();
  return normalizeFixture(request, "hold");
}

export async function demoPMFreakAocDecisionInboxRequireEvidenceItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = demoPMFreakAocBillingMissingEvidenceRequest();
  const response = await demoPMFreakAocBillingMissingEvidenceResponse();
  return createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response, source: "local_mock", createdAtLabel: FIXED_CREATED_AT_LABEL });
}

export async function demoPMFreakAocDecisionInboxRequirePmApprovalItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = demoPMFreakAocScheduleRequiresPmApprovalRequest();
  const response = await demoPMFreakAocScheduleRequiresPmApprovalResponse();
  return createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response, source: "local_mock", createdAtLabel: FIXED_CREATED_AT_LABEL });
}

export async function demoPMFreakAocDecisionInboxRequireCustomerValidationItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = demoPMFreakAocClientCommunicationRequiresApprovalRequest();
  const response = await demoPMFreakAocClientCommunicationRequiresApprovalResponse();
  return createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response, source: "local_mock", createdAtLabel: FIXED_CREATED_AT_LABEL });
}

export async function demoPMFreakAocDecisionInboxRequireBillingReviewItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = demoPMFreakAocBillingMissingApprovalRequest();
  const response = await demoPMFreakAocBillingMissingApprovalResponse();
  return createPMFreakAocDecisionInboxItemFromGovernanceResponse({ request, response, source: "local_mock", createdAtLabel: FIXED_CREATED_AT_LABEL });
}

export async function demoPMFreakAocDecisionInboxRequireContractReviewItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocChangeControlActionAttempt(),
    providedEvidenceIds: [],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.contract_review.v1"],
  });
  return normalizeFixture(request);
}

export async function demoPMFreakAocDecisionInboxRequireSecurityReviewItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocSecurityReviewActionAttempt(),
    providedEvidenceIds: [],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.security_review.v1"],
  });
  return normalizeFixture(request);
}

export async function demoPMFreakAocDecisionInboxRequireExecutiveApprovalItem(): Promise<PMFreakAocDecisionInboxItem> {
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocExecutiveApprovalActionAttempt(),
    providedEvidenceIds: [],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.executive_approval.v1"],
  });
  return normalizeFixture(request);
}

export async function demoPMFreakAocDecisionInboxMixedItems(): Promise<PMFreakAocDecisionInboxItem[]> {
  return Promise.all([
    demoPMFreakAocDecisionInboxAllowItem(),
    demoPMFreakAocDecisionInboxDenyItem(),
    demoPMFreakAocDecisionInboxHoldItem(),
    demoPMFreakAocDecisionInboxRequireEvidenceItem(),
    demoPMFreakAocDecisionInboxRequirePmApprovalItem(),
    demoPMFreakAocDecisionInboxRequireCustomerValidationItem(),
    demoPMFreakAocDecisionInboxRequireBillingReviewItem(),
    demoPMFreakAocDecisionInboxRequireContractReviewItem(),
    demoPMFreakAocDecisionInboxRequireSecurityReviewItem(),
    demoPMFreakAocDecisionInboxRequireExecutiveApprovalItem(),
  ]);
}

export function demoPMFreakAocDecisionInboxEmpty(): PMFreakAocDecisionInboxItem[] {
  return [];
}

export async function demoPMFreakAocDecisionInboxWithErrors(): Promise<PMFreakAocDecisionInboxItem[]> {
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
    providedEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    missingEvidenceIds: [],
    providedApprovalIds: ["demo.approval.billing_review.v1"],
    missingApprovalIds: [],
    billingContext: {
      billingSensitive: true,
      milestoneId: "demo.milestone.aoc-fixture.v1",
      billingReviewReferenceIds: ["demo.approval.billing_review.v1"],
    },
    errors: ["demo.error.sample-config-issue.v1"],
  });
  const item = await normalizeFixture(request);
  return [item];
}

export async function demoPMFreakAocDecisionInboxWithWarnings(): Promise<PMFreakAocDecisionInboxItem[]> {
  const request = createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
    providedEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    missingEvidenceIds: [],
    providedApprovalIds: ["demo.approval.billing_review.v1"],
    missingApprovalIds: [],
    billingContext: {
      billingSensitive: true,
      milestoneId: "demo.milestone.aoc-fixture.v1",
      billingReviewReferenceIds: ["demo.approval.billing_review.v1"],
    },
    warnings: ["demo.warning.sample-notice.v1"],
  });
  const item = await normalizeFixture(request);
  return [item];
}
