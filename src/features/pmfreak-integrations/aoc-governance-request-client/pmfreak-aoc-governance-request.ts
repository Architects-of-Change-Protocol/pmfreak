import type { PMFreakAocActionCategory, PMFreakAocAgentActionAttempt } from "./pmfreak-aoc-action-attempt";
import type { PMFreakAocGovernanceRequestMode } from "./pmfreak-aoc-governance-client-types";

export type PMFreakAocGovernanceRequest = {
  requestId: string;
  clientId: string;

  providerId: "pmfreak";
  consumerOf: "aoc";

  requestMode: PMFreakAocGovernanceRequestMode;

  actionAttempt: PMFreakAocAgentActionAttempt;

  projectContext: {
    projectId: string;
    workspaceId?: string;
    tenantId?: string;
    customerId?: string;
    phase?: string;
    status?: string;
  };

  agentContext: {
    agentId: string;
    agentRole: string;
    passportId?: string;
  };

  actionContext: {
    actionId: string;
    actionCategory: PMFreakAocActionCategory;
    actionTitle: string;
    targetMilestoneId?: string;
    targetTaskId?: string;
    targetRiskId?: string;
    targetChangeRequestId?: string;
    contextFlags: string[];
  };

  evidenceContext: {
    evidenceReferenceIds: string[];
    providedEvidenceIds: string[];
    missingEvidenceIds: string[];
  };

  approvalContext: {
    approvalReferenceIds: string[];
    providedApprovalIds: string[];
    missingApprovalIds: string[];
  };

  riskContext?: {
    riskIds: string[];
    maxSeverity?: "low" | "medium" | "high" | "critical" | "unknown";
  };

  billingContext?: {
    billingSensitive: boolean;
    milestoneId?: string;
    billingReviewReferenceIds: string[];
  };

  policyContext?: {
    requestedPolicyPackIds: string[];
    requestedJurisdictionPackIds: string[];
  };

  safeLabels: string[];
  warnings: string[];
  errors: string[];
};
