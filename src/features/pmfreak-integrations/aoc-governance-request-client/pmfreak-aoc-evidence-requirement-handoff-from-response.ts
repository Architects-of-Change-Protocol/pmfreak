import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_DISCLAIMERS,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS,
} from "./pmfreak-aoc-evidence-requirement-handoff-constants";
import { createPMFreakAocEvidenceRequirementHandoffConfig } from "./pmfreak-aoc-evidence-requirement-handoff-config";
import type { PMFreakAocEvidenceRequirementHandoffConfig } from "./pmfreak-aoc-evidence-requirement-handoff-config";
import { normalizePMFreakAocEvidenceRequirementHandoffContext } from "./pmfreak-aoc-evidence-requirement-handoff-context";
import { extractPMFreakAocEvidenceRequirementReferences } from "./pmfreak-aoc-evidence-requirement-handoff-extractor";
import { createPMFreakAocEvidenceRequirementHandoffSafeNextStep } from "./pmfreak-aoc-evidence-requirement-handoff-next-step";
import { createPMFreakAocEvidenceRequirementChecklistViewModel } from "./pmfreak-aoc-evidence-requirement-handoff-checklist-view-model";
import { createPMFreakAocEvidenceRequirementReviewPacket } from "./pmfreak-aoc-evidence-requirement-handoff-review-packet";
import {
  assertNoPMFreakAocEvidenceRequirementHandoffOverclaim,
  evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety,
} from "./pmfreak-aoc-evidence-requirement-handoff-claim-safety";
import { buildPMFreakAocEvidenceRequirementHandoffId, resolvePMFreakAocEvidenceRequirementHandoffIdBasis } from "./pmfreak-aoc-evidence-requirement-handoff-package";
import type { PMFreakAocEvidenceRequirementHandoffPackage } from "./pmfreak-aoc-evidence-requirement-handoff-package";
import type { PMFreakAocGovernanceResponse } from "./pmfreak-aoc-governance-response";

export type PMFreakAocEvidenceRequirementHandoffFromGovernanceResponseInput = {
  response: PMFreakAocGovernanceResponse;
  config?: Partial<PMFreakAocEvidenceRequirementHandoffConfig>;
};

const TITLE = "Evidence Requirement Handoff";

// A PMFreakAocGovernanceResponse carries no project/action/agent context
// on its own (that lives on the paired request, not the response) — this
// builder legitimately leaves those fields undefined. Pure and
// deterministic — never mutates `input`, never calls AOC, never attaches
// evidence, never creates a task.
export function createPMFreakAocEvidenceRequirementHandoffFromGovernanceResponse(
  input: PMFreakAocEvidenceRequirementHandoffFromGovernanceResponseInput,
): PMFreakAocEvidenceRequirementHandoffPackage {
  const config = createPMFreakAocEvidenceRequirementHandoffConfig(input.config);
  const { response } = input;

  const context = normalizePMFreakAocEvidenceRequirementHandoffContext({ response });

  const requirementItems = extractPMFreakAocEvidenceRequirementReferences({
    requiredEvidenceIds: context.requiredEvidenceIds,
    missingEvidenceIds: context.missingEvidenceIds,
    requiredApprovalIds: config.includeApprovalReferences ? context.requiredApprovalIds : [],
    missingApprovalIds: config.includeApprovalReferences ? context.missingApprovalIds : [],
    reasonCodes: context.reasonCodes,
    actionCategory: context.actionCategory,
    verdict: context.verdict,
    decision: context.decision,
    source: "governance_response",
    requestId: context.requestId,
    responseId: context.responseId,
    gateResultId: context.gateResultId,
    inboxItemId: context.inboxItemId,
    displayModelId: context.displayModelId,
    clientId: context.clientId,
    projectId: context.projectId,
    workspaceId: context.workspaceId,
    tenantId: context.tenantId,
    customerId: context.customerId,
    agentId: context.agentId,
    agentRole: context.agentRole,
    actionId: context.actionId,
    actionTitle: context.actionTitle,
  });

  const checklist = createPMFreakAocEvidenceRequirementChecklistViewModel(requirementItems);
  const reviewPacket = createPMFreakAocEvidenceRequirementReviewPacket({ source: "governance_response", context, requirementItems });

  const candidateSafeSummary = `Evidence requirement handoff for governance response ${response.responseId}: ${requirementItems.length} requirement reference(s), ${context.missingEvidenceIds.length} missing evidence reference(s), ${context.missingApprovalIds.length} missing approval reference(s).`;
  const candidateSafeNextStep = createPMFreakAocEvidenceRequirementHandoffSafeNextStep({
    requirementItems,
    verdict: context.verdict,
    decision: context.decision,
  });

  const claimSafety = evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety({ safeSummary: candidateSafeSummary, safeNextStep: candidateSafeNextStep });
  const safeSummary = claimSafety.safe ? candidateSafeSummary : "This evidence requirement handoff summary was withheld because it failed a claim-safety check.";
  const safeNextStep = claimSafety.safe ? candidateSafeNextStep : "Review the evidence requirements before attempting this action again.";
  const finalErrors = claimSafety.safe ? [...context.errors] : [...context.errors, `Unsafe phrase(s) detected: ${claimSafety.unsafePhrases.join(", ")}`];

  const idBasis = resolvePMFreakAocEvidenceRequirementHandoffIdBasis(context);
  const handoffId = buildPMFreakAocEvidenceRequirementHandoffId(idBasis);

  const candidate: PMFreakAocEvidenceRequirementHandoffPackage = {
    handoffId,
    featureId: PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_ID,
    source: "governance_response",

    requestId: context.requestId,
    responseId: context.responseId,
    gateResultId: context.gateResultId,
    inboxItemId: context.inboxItemId,
    displayModelId: context.displayModelId,
    clientId: context.clientId,

    projectId: context.projectId,
    workspaceId: context.workspaceId,
    tenantId: context.tenantId,
    customerId: context.customerId,

    agentId: context.agentId,
    agentRole: context.agentRole,
    actionId: context.actionId,
    actionCategory: context.actionCategory,
    actionTitle: context.actionTitle,

    verdict: context.verdict,
    decision: context.decision,

    title: TITLE,
    safeSummary,
    safeNextStep,

    requirementItems,

    requiredEvidenceIds: [...context.requiredEvidenceIds],
    missingEvidenceIds: [...context.missingEvidenceIds],
    requiredApprovalIds: [...context.requiredApprovalIds],
    missingApprovalIds: [...context.missingApprovalIds],

    checklist,
    reviewPacket,

    warnings: [...context.warnings],
    errors: finalErrors,
    safeLabels: [...new Set([...context.safeLabels, ...PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_SAFE_LABELS])],
    disclaimers: [...PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_DISCLAIMERS],

    handoffOnly: true,
    evidenceAttachmentCapable: false,
    uploadCapable: false,
    taskCreationCapable: false,
    actionExecutionCapable: false,
    mutationCapable: false,
    writebackCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
    legalCertificationCapable: false,
    complianceCertificationCapable: false,
    customerAcceptanceCertificationCapable: false,
  };

  assertNoPMFreakAocEvidenceRequirementHandoffOverclaim(candidate);

  return candidate;
}
