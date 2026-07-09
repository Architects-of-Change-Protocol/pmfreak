import type { PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import { PMFREAK_AOC_GOVERNANCE_SAFE_LABELS } from "./pmfreak-aoc-governance-client-constants";
import { createPMFreakAocGovernanceRequestClientConfig, type PMFreakAocGovernanceRequestClientConfig } from "./pmfreak-aoc-governance-client-config";
import type { PMFreakAocGovernanceRequest } from "./pmfreak-aoc-governance-request";

// Deterministic, filesystem/network-free slugging: lowercase, collapse
// anything outside [a-z0-9._-] into a single hyphen, trim stray separators.
function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function buildPMFreakAocGovernanceRequestId(actionAttemptId: string): string {
  return `pmfreak.aoc.request.${toSafeIdSegment(actionAttemptId)}.v1`;
}

export type PMFreakAocGovernanceRequestBuilderInput = {
  config?: Partial<PMFreakAocGovernanceRequestClientConfig>;
  actionAttempt: PMFreakAocAgentActionAttempt;
  projectContext?: Partial<PMFreakAocGovernanceRequest["projectContext"]>;
  providedEvidenceIds?: string[];
  missingEvidenceIds?: string[];
  providedApprovalIds?: string[];
  missingApprovalIds?: string[];
  riskContext?: PMFreakAocGovernanceRequest["riskContext"];
  billingContext?: PMFreakAocGovernanceRequest["billingContext"];
  policyContext?: PMFreakAocGovernanceRequest["policyContext"];
  warnings?: string[];
  errors?: string[];
};

// Pure, deterministic transformation: builds a governance request from an
// action attempt without mutating any input, executing the action, writing
// to a database or calling AOC.
export function createPMFreakAocGovernanceRequest(input: PMFreakAocGovernanceRequestBuilderInput): PMFreakAocGovernanceRequest {
  const config = createPMFreakAocGovernanceRequestClientConfig(input.config);
  const actionAttempt: PMFreakAocAgentActionAttempt = {
    ...input.actionAttempt,
    contextFlags: [...input.actionAttempt.contextFlags],
    evidenceReferenceIds: [...input.actionAttempt.evidenceReferenceIds],
    approvalReferenceIds: [...input.actionAttempt.approvalReferenceIds],
    metadata: { ...input.actionAttempt.metadata },
  };

  const requestId = buildPMFreakAocGovernanceRequestId(actionAttempt.actionAttemptId);

  return {
    requestId,
    clientId: config.clientId,
    providerId: "pmfreak",
    consumerOf: "aoc",
    requestMode: config.requestMode,
    actionAttempt,
    projectContext: {
      projectId: actionAttempt.projectId,
      workspaceId: actionAttempt.workspaceId,
      tenantId: actionAttempt.tenantId,
      customerId: actionAttempt.customerId,
      ...input.projectContext,
    },
    agentContext: {
      agentId: actionAttempt.agentId,
      agentRole: actionAttempt.agentRole,
      passportId: actionAttempt.passportId,
    },
    actionContext: {
      actionId: actionAttempt.actionId,
      actionCategory: actionAttempt.actionCategory,
      actionTitle: actionAttempt.actionTitle,
      targetMilestoneId: actionAttempt.targetMilestoneId,
      targetTaskId: actionAttempt.targetTaskId,
      targetRiskId: actionAttempt.targetRiskId,
      targetChangeRequestId: actionAttempt.targetChangeRequestId,
      contextFlags: [...actionAttempt.contextFlags],
    },
    evidenceContext: {
      evidenceReferenceIds: [...actionAttempt.evidenceReferenceIds],
      providedEvidenceIds: [...(input.providedEvidenceIds ?? [])],
      missingEvidenceIds: [...(input.missingEvidenceIds ?? [])],
    },
    approvalContext: {
      approvalReferenceIds: [...actionAttempt.approvalReferenceIds],
      providedApprovalIds: [...(input.providedApprovalIds ?? [])],
      missingApprovalIds: [...(input.missingApprovalIds ?? [])],
    },
    riskContext: input.riskContext
      ? { riskIds: [...input.riskContext.riskIds], maxSeverity: input.riskContext.maxSeverity }
      : undefined,
    billingContext: input.billingContext
      ? {
          billingSensitive: input.billingContext.billingSensitive,
          milestoneId: input.billingContext.milestoneId,
          billingReviewReferenceIds: [...input.billingContext.billingReviewReferenceIds],
        }
      : undefined,
    policyContext: input.policyContext
      ? {
          requestedPolicyPackIds: [...input.policyContext.requestedPolicyPackIds],
          requestedJurisdictionPackIds: [...input.policyContext.requestedJurisdictionPackIds],
        }
      : undefined,
    safeLabels: [...PMFREAK_AOC_GOVERNANCE_SAFE_LABELS],
    warnings: [...(input.warnings ?? [])],
    errors: [...(input.errors ?? [])],
  };
}
