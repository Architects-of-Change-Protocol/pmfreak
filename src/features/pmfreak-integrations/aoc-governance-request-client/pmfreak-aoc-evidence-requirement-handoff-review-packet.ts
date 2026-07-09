import type { PMFreakAocEvidenceRequirementHandoffContext } from "./pmfreak-aoc-evidence-requirement-handoff-context";
import type { PMFreakAocEvidenceRequirementItem } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import { resolvePMFreakAocEvidenceRequirementHandoffIdBasis } from "./pmfreak-aoc-evidence-requirement-handoff-package";
import { toSafeIdSegment } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import type { PMFreakAocEvidenceRequirementSource } from "./pmfreak-aoc-evidence-requirement-handoff-source";

export type PMFreakAocEvidenceRequirementReviewPacket = {
  packetId: string;
  title: string;
  summary: string;
  source: PMFreakAocEvidenceRequirementSource;

  requestId?: string;
  responseId?: string;
  gateResultId?: string;
  inboxItemId?: string;
  displayModelId?: string;
  clientId?: string;

  projectId?: string;
  actionId?: string;
  actionTitle?: string;
  actionCategory?: string;

  requirementItems: PMFreakAocEvidenceRequirementItem[];

  requiredEvidenceIds: string[];
  missingEvidenceIds: string[];
  requiredApprovalIds: string[];
  missingApprovalIds: string[];

  reviewQuestions: string[];
  safetyDisclaimers: string[];

  handoffOnly: true;
  evidenceAttachmentCapable: false;
  taskCreationCapable: false;
  approvalCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
};

const REVIEW_QUESTIONS = [
  "Which evidence references are missing?",
  "Which evidence references are available?",
  "Which approval references are required?",
  "Is customer acceptance evidence available to link in a future workflow?",
  "Is billing review evidence available to link in a future workflow?",
] as const;

const SAFETY_DISCLAIMERS = [
  "This review packet does not attach evidence.",
  "This review packet does not create tasks.",
  "This review packet does not approve anything.",
  "This review packet does not create an invoice.",
  "This review packet does not send communications.",
] as const;

export type PMFreakAocEvidenceRequirementReviewPacketInput = {
  source: PMFreakAocEvidenceRequirementSource;
  context: PMFreakAocEvidenceRequirementHandoffContext;
  requirementItems: PMFreakAocEvidenceRequirementItem[];
};

// Pure, deterministic construction from an already-normalized context and
// an already-extracted requirement item list. Never attaches evidence,
// never creates a task, never approves anything.
export function createPMFreakAocEvidenceRequirementReviewPacket(
  input: PMFreakAocEvidenceRequirementReviewPacketInput,
): PMFreakAocEvidenceRequirementReviewPacket {
  const { context, requirementItems } = input;
  const idBasis = resolvePMFreakAocEvidenceRequirementHandoffIdBasis(context);

  return {
    packetId: `pmfreak.aoc.evidence.review-packet.${toSafeIdSegment(idBasis)}.v1`,
    title: "Evidence Requirement Review Packet",
    summary: `Review packet for ${requirementItems.length} evidence/approval requirement reference(s).`,
    source: input.source,

    requestId: context.requestId,
    responseId: context.responseId,
    gateResultId: context.gateResultId,
    inboxItemId: context.inboxItemId,
    displayModelId: context.displayModelId,
    clientId: context.clientId,

    projectId: context.projectId,
    actionId: context.actionId,
    actionTitle: context.actionTitle,
    actionCategory: context.actionCategory,

    requirementItems: [...requirementItems],

    requiredEvidenceIds: [...context.requiredEvidenceIds],
    missingEvidenceIds: [...context.missingEvidenceIds],
    requiredApprovalIds: [...context.requiredApprovalIds],
    missingApprovalIds: [...context.missingApprovalIds],

    reviewQuestions: [...REVIEW_QUESTIONS],
    safetyDisclaimers: [...SAFETY_DISCLAIMERS],

    handoffOnly: true,
    evidenceAttachmentCapable: false,
    taskCreationCapable: false,
    approvalCapable: false,
    invoiceCreationCapable: false,
    communicationCapable: false,
  };
}
