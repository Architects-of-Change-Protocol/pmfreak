import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type { PMFreakAocGovernedActionGateVerdict } from "./pmfreak-aoc-governed-action-gate-types";
import type { PMFreakAocEvidenceRequirementChecklistViewModel } from "./pmfreak-aoc-evidence-requirement-handoff-checklist-view-model";
import type { PMFreakAocEvidenceRequirementItem } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import { toSafeIdSegment } from "./pmfreak-aoc-evidence-requirement-handoff-item";
import type { PMFreakAocEvidenceRequirementReviewPacket } from "./pmfreak-aoc-evidence-requirement-handoff-review-packet";
import type { PMFreakAocEvidenceRequirementSource } from "./pmfreak-aoc-evidence-requirement-handoff-source";

export type PMFreakAocEvidenceRequirementHandoffPackage = {
  handoffId: string;
  featureId: string;
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

  verdict?: PMFreakAocGovernedActionGateVerdict;
  decision?: PMFreakAocGovernanceDecision;

  title: string;
  safeSummary: string;
  safeNextStep: string;

  requirementItems: PMFreakAocEvidenceRequirementItem[];

  requiredEvidenceIds: string[];
  missingEvidenceIds: string[];
  requiredApprovalIds: string[];
  missingApprovalIds: string[];

  checklist: PMFreakAocEvidenceRequirementChecklistViewModel;
  reviewPacket: PMFreakAocEvidenceRequirementReviewPacket;

  warnings: string[];
  errors: string[];
  safeLabels: string[];
  disclaimers: string[];

  handoffOnly: true;
  evidenceAttachmentCapable: false;
  uploadCapable: false;
  taskCreationCapable: false;
  actionExecutionCapable: false;
  mutationCapable: false;
  writebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  legalCertificationCapable: false;
  complianceCertificationCapable: false;
  customerAcceptanceCertificationCapable: false;
};

const UNSPECIFIED_ID_BASIS = "unspecified";

// Deterministic ID-basis precedence shared by handoffId and packetId:
// gateResultId, then responseId, then inboxItemId, then displayModelId,
// then a fixed fallback.
export function resolvePMFreakAocEvidenceRequirementHandoffIdBasis(context: {
  gateResultId?: string;
  responseId?: string;
  inboxItemId?: string;
  displayModelId?: string;
}): string {
  return context.gateResultId ?? context.responseId ?? context.inboxItemId ?? context.displayModelId ?? UNSPECIFIED_ID_BASIS;
}

export function buildPMFreakAocEvidenceRequirementHandoffId(idBasis: string): string {
  return `pmfreak.aoc.evidence.handoff.${toSafeIdSegment(idBasis)}.v1`;
}
