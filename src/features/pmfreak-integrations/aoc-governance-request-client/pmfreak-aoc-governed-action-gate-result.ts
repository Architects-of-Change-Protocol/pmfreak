import type { PMFreakAocGovernanceDecision } from "./pmfreak-aoc-governance-response";
import type {
  PMFreakAocGovernedActionGateReasonCode,
  PMFreakAocGovernedActionGateSeverity,
  PMFreakAocGovernedActionGateTraceStep,
  PMFreakAocGovernedActionGateVerdict,
} from "./pmfreak-aoc-governed-action-gate-types";

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

export function buildPMFreakAocGovernedActionGateResultId(idBasis: string): string {
  return `pmfreak.aoc.gate.result.${toSafeIdSegment(idBasis)}.v1`;
}

export type PMFreakAocGovernedActionGateResult = {
  gateResultId: string;
  gateId: string;

  gateInputId?: string;

  requestId?: string;
  responseId?: string;
  inboxItemId?: string;
  clientId?: string;

  actionAttemptId?: string;
  agentId?: string;
  agentRole?: string;
  projectId?: string;
  workspaceId?: string;
  tenantId?: string;
  customerId?: string;
  actionId?: string;
  actionCategory?: string;
  actionTitle?: string;

  aocDecision?: PMFreakAocGovernanceDecision;

  verdict: PMFreakAocGovernedActionGateVerdict;
  severity: PMFreakAocGovernedActionGateSeverity;

  canProceed: boolean;
  blocked: boolean;
  requiresEvidence: boolean;
  requiresApproval: boolean;
  requiresReview: boolean;

  reasonCodes: PMFreakAocGovernedActionGateReasonCode[];
  decisionReasonCodes: string[];

  safeSummary: string;
  safeNextStep: string;

  requiredEvidenceIds: string[];
  requiredApprovalIds: string[];
  missingEvidenceIds: string[];
  missingApprovalIds: string[];

  warnings: string[];
  errors: string[];
  safeLabels: string[];

  trace: PMFreakAocGovernedActionGateTraceStep[];

  gateOnly: true;
  actionExecutionCapable: false;
  mutationCapable: false;
  writebackCapable: false;
  invoiceCreationCapable: false;
  communicationCapable: false;
  legalCertificationCapable: false;
  complianceCertificationCapable: false;
};
