import type { PMFreakAocEvidenceRequirementSource } from "./pmfreak-aoc-evidence-requirement-handoff-source";
import type { PMFreakAocEvidenceRequirementStatus } from "./pmfreak-aoc-evidence-requirement-handoff-status";
import type { PMFreakAocEvidenceRequirementPriority } from "./pmfreak-aoc-evidence-requirement-handoff-priority";

export type PMFreakAocEvidenceRequirementType =
  | "customer_acceptance"
  | "billing_review"
  | "contract_review"
  | "security_review"
  | "pm_approval"
  | "executive_approval"
  | "delivery_confirmation"
  | "technical_validation"
  | "change_approval"
  | "risk_review"
  | "unknown";

export type PMFreakAocEvidenceRequirementItem = {
  requirementItemId: string;
  requirementType: PMFreakAocEvidenceRequirementType;
  status: PMFreakAocEvidenceRequirementStatus;
  priority: PMFreakAocEvidenceRequirementPriority;

  referenceId: string;
  label: string;
  description: string;
  source: PMFreakAocEvidenceRequirementSource;

  requestId?: string;
  responseId?: string;
  gateResultId?: string;
  inboxItemId?: string;
  displayModelId?: string;
  clientId?: string;

  projectId?: string;
  workspaceId?: string;
  tenantId?: string;
  customerId?: string;

  agentId?: string;
  agentRole?: string;
  actionId?: string;
  actionCategory?: string;
  actionTitle?: string;

  reasonCodes: string[];
  safeNextStep: string;

  attachmentCapable: false;
  uploadCapable: false;
  taskCreationCapable: false;
  mutationCapable: false;
  communicationCapable: false;
};

// Deterministic, filesystem/network-free slugging: lowercase, collapse
// anything outside [a-z0-9._-] into a single hyphen, trim stray separators.
// Reused verbatim across every file in this feature that builds a
// deterministic ID.
export function toSafeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

export function buildPMFreakAocEvidenceRequirementItemId(referenceId: string): string {
  return `pmfreak.aoc.evidence.requirement.${toSafeIdSegment(referenceId)}.v1`;
}
