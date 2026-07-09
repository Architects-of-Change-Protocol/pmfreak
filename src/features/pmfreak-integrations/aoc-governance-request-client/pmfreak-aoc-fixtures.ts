import type { PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import { createPMFreakAocGovernanceRequestClientConfig } from "./pmfreak-aoc-governance-client-config";
import { createLocalMockPMFreakAocGovernanceTransport } from "./pmfreak-aoc-local-governance-transport";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";
import { createPMFreakAocGovernanceRequest } from "./pmfreak-aoc-request-builder";

// All identifiers below are fake and demo-only: no real customer names,
// Datasys project IDs, emails, contract numbers or invoice numbers.

export function demoPMFreakAocBillingReadinessActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.billing-readiness.v1",
    agentId: "demo.agent.billing-readiness.v1",
    agentRole: "billing_readiness_agent",
    passportId: "demo.passport.billing-readiness.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.mark-milestone-billing-ready.v1",
    actionCategory: "billing",
    actionTitle: "Mark milestone ready for billing",
    actionDescription: "Billing Readiness Agent wants to mark a milestone as ready for billing.",
    targetMilestoneId: "demo.milestone.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["billing_sensitive"],
    evidenceReferenceIds: ["demo.evidence.customer-acceptance.v1"],
    approvalReferenceIds: ["demo.approval.billing_review.v1"],
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}

export function demoPMFreakAocScheduleChangeActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.schedule-change.v1",
    agentId: "demo.agent.planning.v1",
    agentRole: "planning_agent",
    passportId: "demo.passport.planning.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.update-schedule.v1",
    actionCategory: "schedule",
    actionTitle: "Shift milestone due date",
    actionDescription: "Planning Agent wants to move a milestone's due date.",
    targetMilestoneId: "demo.milestone.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["schedule_change"],
    evidenceReferenceIds: [],
    approvalReferenceIds: ["demo.approval.pm_approval.v1"],
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}

export function demoPMFreakAocRiskEscalationActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.risk-escalation.v1",
    agentId: "demo.agent.risk.v1",
    agentRole: "risk_agent",
    passportId: "demo.passport.risk.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.escalate-risk.v1",
    actionCategory: "risk",
    actionTitle: "Escalate project risk",
    actionDescription: "Risk Agent wants to escalate a project risk.",
    targetRiskId: "demo.risk.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["risk_escalation"],
    evidenceReferenceIds: ["demo.evidence.risk-assessment.v1"],
    approvalReferenceIds: [],
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}

export function demoPMFreakAocClientCommunicationActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.client-communication.v1",
    agentId: "demo.agent.client-communication.v1",
    agentRole: "client_communication_agent",
    passportId: "demo.passport.client-communication.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.send-status-update.v1",
    actionCategory: "communication",
    actionTitle: "Send client status update",
    actionDescription: "Client Communication Agent wants to send a status update to the customer.",
    status: "pending_aoc_governance",
    contextFlags: ["client_facing"],
    evidenceReferenceIds: [],
    approvalReferenceIds: ["demo.approval.customer_validation.v1"],
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}

export function demoPMFreakAocChangeControlActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.change-control.v1",
    agentId: "demo.agent.change-control.v1",
    agentRole: "change_control_agent",
    passportId: "demo.passport.change-control.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.approve-change-request.v1",
    actionCategory: "change_control",
    actionTitle: "Approve a change request",
    actionDescription: "Change Control Agent wants to approve a scope change request.",
    targetChangeRequestId: "demo.change-request.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["change_control"],
    evidenceReferenceIds: [],
    approvalReferenceIds: ["demo.approval.contract_review.v1"],
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}

export function demoPMFreakAocEvidenceActionAttempt(): PMFreakAocAgentActionAttempt {
  return {
    actionAttemptId: "demo.pmfreak.action-attempt.evidence.v1",
    agentId: "demo.agent.evidence.v1",
    agentRole: "evidence_agent",
    passportId: "demo.passport.evidence.v1",
    projectId: "demo.project.aoc-fixture.v1",
    workspaceId: "demo.workspace.aoc-fixture.v1",
    tenantId: "demo.tenant.aoc-fixture.v1",
    customerId: "demo.customer.aoc-fixture.v1",
    actionId: "demo.action.attach-evidence.v1",
    actionCategory: "evidence",
    actionTitle: "Attach evidence to milestone",
    actionDescription: "Evidence Agent wants to attach supporting evidence to a milestone.",
    targetMilestoneId: "demo.milestone.aoc-fixture.v1",
    status: "pending_aoc_governance",
    contextFlags: ["evidence_attachment"],
    evidenceReferenceIds: ["demo.evidence.supporting-doc.v1"],
    approvalReferenceIds: [],
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}

export function demoPMFreakAocBillingMissingEvidenceRequest(): PMFreakAocGovernanceRequest {
  return createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
    providedEvidenceIds: [],
    missingEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    providedApprovalIds: [],
    missingApprovalIds: [],
    billingContext: {
      billingSensitive: true,
      milestoneId: "demo.milestone.aoc-fixture.v1",
      billingReviewReferenceIds: ["demo.approval.billing_review.v1"],
    },
  });
}

export function demoPMFreakAocBillingMissingApprovalRequest(): PMFreakAocGovernanceRequest {
  return createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocBillingReadinessActionAttempt(),
    providedEvidenceIds: ["demo.evidence.customer-acceptance.v1"],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.billing_review.v1"],
    billingContext: {
      billingSensitive: true,
      milestoneId: "demo.milestone.aoc-fixture.v1",
      billingReviewReferenceIds: ["demo.approval.billing_review.v1"],
    },
  });
}

export function demoPMFreakAocBillingAllowedRequest(): PMFreakAocGovernanceRequest {
  return createPMFreakAocGovernanceRequest({
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
  });
}

export function demoPMFreakAocScheduleRequiresPmApprovalRequest(): PMFreakAocGovernanceRequest {
  return createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocScheduleChangeActionAttempt(),
    providedEvidenceIds: [],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.pm_approval.v1"],
  });
}

export function demoPMFreakAocRiskEscalationAllowedRequest(): PMFreakAocGovernanceRequest {
  return createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocRiskEscalationActionAttempt(),
    providedEvidenceIds: ["demo.evidence.risk-assessment.v1"],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: [],
    riskContext: {
      riskIds: ["demo.risk.aoc-fixture.v1"],
      maxSeverity: "medium",
    },
  });
}

export function demoPMFreakAocClientCommunicationRequiresApprovalRequest(): PMFreakAocGovernanceRequest {
  return createPMFreakAocGovernanceRequest({
    actionAttempt: demoPMFreakAocClientCommunicationActionAttempt(),
    providedEvidenceIds: [],
    missingEvidenceIds: [],
    providedApprovalIds: [],
    missingApprovalIds: ["demo.approval.customer_validation.v1"],
  });
}

async function evaluateWithLocalMockTransport(request: PMFreakAocGovernanceRequest): Promise<PMFreakAocGovernanceResponse> {
  const transport = createLocalMockPMFreakAocGovernanceTransport();
  const config = createPMFreakAocGovernanceRequestClientConfig();
  return transport.evaluateGovernanceRequest(request, config);
}

export function demoPMFreakAocBillingMissingEvidenceResponse(): Promise<PMFreakAocGovernanceResponse> {
  return evaluateWithLocalMockTransport(demoPMFreakAocBillingMissingEvidenceRequest());
}

export function demoPMFreakAocBillingMissingApprovalResponse(): Promise<PMFreakAocGovernanceResponse> {
  return evaluateWithLocalMockTransport(demoPMFreakAocBillingMissingApprovalRequest());
}

export function demoPMFreakAocBillingAllowedResponse(): Promise<PMFreakAocGovernanceResponse> {
  return evaluateWithLocalMockTransport(demoPMFreakAocBillingAllowedRequest());
}

export function demoPMFreakAocScheduleRequiresPmApprovalResponse(): Promise<PMFreakAocGovernanceResponse> {
  return evaluateWithLocalMockTransport(demoPMFreakAocScheduleRequiresPmApprovalRequest());
}

export function demoPMFreakAocRiskEscalationAllowedResponse(): Promise<PMFreakAocGovernanceResponse> {
  return evaluateWithLocalMockTransport(demoPMFreakAocRiskEscalationAllowedRequest());
}

export function demoPMFreakAocClientCommunicationRequiresApprovalResponse(): Promise<PMFreakAocGovernanceResponse> {
  return evaluateWithLocalMockTransport(demoPMFreakAocClientCommunicationRequiresApprovalRequest());
}
