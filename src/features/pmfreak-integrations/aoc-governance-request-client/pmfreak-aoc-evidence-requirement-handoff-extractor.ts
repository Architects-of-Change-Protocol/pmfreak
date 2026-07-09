import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import type { PMFreakAocEvidenceRequirementItem, PMFreakAocEvidenceRequirementType } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import { buildPMFreakAocEvidenceRequirementItemId } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import { mapPMFreakAocEvidenceRequirementPriority } from "./pmfreak-aoc-evidence-requirement-handoff-priority";
import type { PMFreakAocEvidenceRequirementSource } from "./pmfreak-aoc-evidence-requirement-handoff-source";
import type { PMFreakAocEvidenceRequirementStatus } from "./pmfreak-aoc-evidence-requirement-handoff-status";

export type PMFreakAocEvidenceRequirementTypeInferenceInput = {
  referenceId: string;
  reasonCodes?: string[];
  actionCategory?: string;
  decision?: PMFreakAocGovernanceDecision;
  verdict?: PMFreakAocGovernedActionGateVerdict;
};

// Case-insensitive substring rules against `referenceId`, checked in
// priority order (first match wins). Falls through to `actionCategory`
// substring checks only when nothing in `referenceId` matches, then to
// `unknown`. Pure and deterministic — no randomness, no clock.
export function inferPMFreakAocEvidenceRequirementType(input: PMFreakAocEvidenceRequirementTypeInferenceInput): PMFreakAocEvidenceRequirementType {
  const reference = input.referenceId.toLowerCase();

  if (reference.includes("customer") || reference.includes("acceptance")) {
    return "customer_acceptance";
  }
  if (reference.includes("billing") || reference.includes("invoice")) {
    return "billing_review";
  }
  if (reference.includes("contract")) {
    return "contract_review";
  }
  if (reference.includes("security")) {
    return "security_review";
  }
  if (reference.includes("executive")) {
    return "executive_approval";
  }
  if (reference.includes("pm") || reference.includes("project-manager")) {
    return "pm_approval";
  }
  if (reference.includes("delivery")) {
    return "delivery_confirmation";
  }
  if (reference.includes("technical") || reference.includes("validation")) {
    return "technical_validation";
  }
  if (reference.includes("change")) {
    return "change_approval";
  }
  if (reference.includes("risk")) {
    return "risk_review";
  }

  const category = (input.actionCategory ?? "").toLowerCase();
  if (category.includes("billing")) {
    return "billing_review";
  }
  if (category.includes("contract")) {
    return "contract_review";
  }
  if (category.includes("security")) {
    return "security_review";
  }

  return "unknown";
}

export type PMFreakAocEvidenceRequirementExtractionInput = {
  requiredEvidenceIds?: string[];
  missingEvidenceIds?: string[];
  requiredApprovalIds?: string[];
  missingApprovalIds?: string[];
  reasonCodes?: string[];
  actionCategory?: string;
  verdict?: PMFreakAocGovernedActionGateVerdict;
  decision?: PMFreakAocGovernanceDecision;
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
  actionTitle?: string;
};

function safeNextStepForItem(requirementType: PMFreakAocEvidenceRequirementType, status: PMFreakAocEvidenceRequirementStatus): string {
  if (status !== "missing") {
    return "Review this requirement reference before attempting the action again.";
  }
  switch (requirementType) {
    case "customer_acceptance":
      return "Collect or link customer acceptance evidence before attempting this action again.";
    case "billing_review":
      return "Prepare the evidence package for billing review. This handoff does not approve billing or create an invoice.";
    case "contract_review":
      return "Prepare the required contract review references before attempting this action again.";
    case "security_review":
      return "Prepare the required security review references before attempting this action again.";
    case "pm_approval":
    case "executive_approval":
      return "Collect the required approval references before attempting this action again.";
    default:
      return "Review the evidence requirements before attempting this action again.";
  }
}

function buildItem(
  referenceId: string,
  status: PMFreakAocEvidenceRequirementStatus,
  input: PMFreakAocEvidenceRequirementExtractionInput,
): PMFreakAocEvidenceRequirementItem {
  const requirementType = inferPMFreakAocEvidenceRequirementType({
    referenceId,
    reasonCodes: input.reasonCodes,
    actionCategory: input.actionCategory,
    decision: input.decision,
    verdict: input.verdict,
  });

  return {
    requirementItemId: buildPMFreakAocEvidenceRequirementItemId(referenceId),
    requirementType,
    status,
    priority: mapPMFreakAocEvidenceRequirementPriority({ requirementType, status, verdict: input.verdict }),

    referenceId,
    label: referenceId,
    description: `${status === "missing" ? "Missing" : "Required"} evidence/approval reference: ${referenceId}`,
    source: input.source,

    requestId: input.requestId,
    responseId: input.responseId,
    gateResultId: input.gateResultId,
    inboxItemId: input.inboxItemId,
    displayModelId: input.displayModelId,
    clientId: input.clientId,

    projectId: input.projectId,
    workspaceId: input.workspaceId,
    tenantId: input.tenantId,
    customerId: input.customerId,

    agentId: input.agentId,
    agentRole: input.agentRole,
    actionId: input.actionId,
    actionCategory: input.actionCategory,
    actionTitle: input.actionTitle,

    reasonCodes: [...(input.reasonCodes ?? [])],
    safeNextStep: safeNextStepForItem(requirementType, status),

    attachmentCapable: false,
    uploadCapable: false,
    taskCreationCapable: false,
    mutationCapable: false,
    communicationCapable: false,
  };
}

// Pure, deterministic extraction. Never mutates any of the caller's
// arrays (copies before reading), never attaches evidence, never creates
// tasks. When an ID appears in both a "required" and "missing" array for
// the same category (evidence or approval), exactly one item is emitted
// with status "missing" — missing wins.
export function extractPMFreakAocEvidenceRequirementReferences(
  input: PMFreakAocEvidenceRequirementExtractionInput,
): PMFreakAocEvidenceRequirementItem[] {
  const requiredEvidenceIds = [...(input.requiredEvidenceIds ?? [])];
  const missingEvidenceIds = [...(input.missingEvidenceIds ?? [])];
  const requiredApprovalIds = [...(input.requiredApprovalIds ?? [])];
  const missingApprovalIds = [...(input.missingApprovalIds ?? [])];

  const missingEvidenceSet = new Set(missingEvidenceIds);
  const missingApprovalSet = new Set(missingApprovalIds);

  const items: PMFreakAocEvidenceRequirementItem[] = [];
  const seen = new Set<string>();

  for (const referenceId of requiredEvidenceIds) {
    const key = `evidence:${referenceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const status: PMFreakAocEvidenceRequirementStatus = missingEvidenceSet.has(referenceId) ? "missing" : "required";
    items.push(buildItem(referenceId, status, input));
  }

  for (const referenceId of missingEvidenceIds) {
    const key = `evidence:${referenceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(buildItem(referenceId, "missing", input));
  }

  for (const referenceId of requiredApprovalIds) {
    const key = `approval:${referenceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const status: PMFreakAocEvidenceRequirementStatus = missingApprovalSet.has(referenceId) ? "missing" : "required";
    items.push(buildItem(referenceId, status, input));
  }

  for (const referenceId of missingApprovalIds) {
    const key = `approval:${referenceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(buildItem(referenceId, "missing", input));
  }

  return items;
}
