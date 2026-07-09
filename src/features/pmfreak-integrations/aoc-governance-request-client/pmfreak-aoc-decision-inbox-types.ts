import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";

// Display-only. These statuses track whether a PM user has looked at an
// inbox entry — they never imply enforcement, approval, execution or
// compliance.
export type PMFreakAocDecisionInboxItemStatus = "new" | "reviewed" | "acknowledged" | "archived";

export type PMFreakAocDecisionInboxDecisionStatus =
  | "allowed"
  | "blocked"
  | "held"
  | "needs_evidence"
  | "needs_pm_approval"
  | "needs_customer_validation"
  | "needs_billing_review"
  | "needs_contract_review"
  | "needs_security_review"
  | "needs_executive_approval"
  | "unknown";

export type PMFreakAocDecisionInboxCategory =
  | "billing"
  | "evidence"
  | "approval"
  | "contract"
  | "security"
  | "customer_validation"
  | "project_governance"
  | "risk"
  | "communication"
  | "unknown";

export type PMFreakAocDecisionInboxSeverity = "success" | "info" | "warning" | "danger";

export type PMFreakAocDecisionInboxItemSource = "local_mock" | "remote_http" | "unsupported_remote" | "unknown";

export type PMFreakAocDecisionInboxItem = {
  inboxItemId: string;
  source: PMFreakAocDecisionInboxItemSource;

  requestId: string;
  responseId: string;
  clientId: string;

  projectId?: string;
  workspaceId?: string;
  tenantId?: string;
  customerId?: string;

  agentId?: string;
  agentRole?: string;
  actionId?: string;
  actionCategory?: string;
  actionTitle?: string;

  decision: PMFreakAocGovernanceDecision;
  decisionLabel: string;
  decisionStatus: PMFreakAocDecisionInboxDecisionStatus;
  decisionSeverity: PMFreakAocDecisionInboxSeverity;
  category: PMFreakAocDecisionInboxCategory;

  safeSummary: string;
  safeNextStep: string;

  reasonCodes: string[];

  requiredEvidenceIds: string[];
  requiredApprovalIds: string[];
  missingEvidenceIds: string[];
  missingApprovalIds: string[];

  warnings: string[];
  errors: string[];
  safeLabels: string[];

  inboxStatus: PMFreakAocDecisionInboxItemStatus;

  createdAtLabel: string;
  updatedAtLabel?: string;

  displayOnly: true;
  actionExecutionCapable: false;
  mutationCapable: false;
  writebackCapable: false;
  enforcementCapable: false;
};
