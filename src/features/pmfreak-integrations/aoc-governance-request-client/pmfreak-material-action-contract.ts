import { createHash } from "node:crypto";

export const PMFREAK_MATERIAL_ACTION_SCHEMA_VERSION = "pmfreak.material-action.v1" as const;
export const PMFREAK_MATERIAL_ACTION_DIGEST_VERSION = "sha256:pmfreak-material-action:v1" as const;

export const PMFREAK_MATERIAL_ACTION_CLASSES = [
  "ordinary_business_write",
  "external_write",
  "authority_mutation",
  "material_agent_action",
  "knowledge_elevation",
  "policy_classified",
] as const;
export type PMFreakMaterialActionClass = (typeof PMFREAK_MATERIAL_ACTION_CLASSES)[number];

export type PMFreakMateriality = "ordinary" | "material" | "unknown" | "prohibited";
export type PMFreakMaterialActionGovernanceState =
  | "not_required"
  | "requires_review"
  | "requires_approval"
  | "authorized"
  | "denied"
  | "revoked"
  | "expired"
  | "stale"
  | "unavailable"
  | "degraded";

export type PMFreakMaterialActionProposalInput = {
  actionId: string;
  workspaceId: string;
  projectId: string;
  originatingSubjectType: "decision" | "recommendation";
  originatingSubjectId: string;
  sourceCorrelationId: string;
  causationId?: string | null;
  evidenceReferenceIds: string[];
  findingReferenceIds?: string[];
  recommendationReferenceIds?: string[];
  decisionReferenceId?: string | null;
  actionClass: PMFreakMaterialActionClass;
  actionType: string;
  targetResourceType: string;
  targetResourceId: string;
  intendedOperation: string;
  intendedEffect: string;
  risk: "low" | "medium" | "high" | "critical" | "unknown";
  reversibility: "reversible" | "partially_reversible" | "irreversible" | "unknown";
  sideEffect: "internal" | "external" | "authority" | "knowledge" | "unknown";
  proposedActorId: string;
  accountableActorId: string;
  requiredApprovalCount: number;
  justification: string;
  constraints?: string[];
  obligationReferenceIds?: string[];
  policySnapshotReference?: string | null;
  grantReference?: string | null;
  expiresAt: string;
  createdAt: string;
  idempotencyKey: string;
  fixture?: { label: "DEMO / FIXTURE"; expiresWhen: "P2-06_VERIFIED" } | null;
};

export type PMFreakMaterialActionProposal = Readonly<PMFreakMaterialActionProposalInput> & {
  schemaVersion: typeof PMFREAK_MATERIAL_ACTION_SCHEMA_VERSION;
  digestVersion: typeof PMFREAK_MATERIAL_ACTION_DIGEST_VERSION;
  materiality: PMFreakMateriality;
  deterministicDigest: string;
  remoteDecisionWriteback: false;
  createsTask: false;
  dispatchesAction: false;
  executesAction: false;
};

export type PMFreakMaterialActionGovernanceEvidence = {
  evaluationId: string;
  evaluatedAt: string;
  evaluatorActorId: string;
  state: PMFreakMaterialActionGovernanceState;
  policyDecisionReference?: string;
  grantReference?: string;
  obligationReferenceIds: string[];
  approvalReferenceIds: string[];
  validUntil?: string;
  reasonCodes: string[];
};

export type PMFreakMaterialActionGovernanceResult = {
  schemaVersion: "pmfreak.material-action-governance-result.v1";
  actionId: string;
  proposalDigest: string;
  state: PMFreakMaterialActionGovernanceState;
  canCommitAction: boolean;
  canExecute: false;
  createsTask: false;
  remoteDecisionWriteback: false;
  evidence: Readonly<PMFreakMaterialActionGovernanceEvidence>;
};

export type PMFreakMaterialActionReplayDisposition = "replay" | "conflict" | "distinct";

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`material_action_invalid:${field}`);
  return normalized;
}

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`material_action_invalid:${field}`);
  return parsed.toISOString();
}

function sortedUnique(values: string[] = []): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function classifyPMFreakMaterialAction(input: Pick<PMFreakMaterialActionProposalInput, "actionClass" | "risk" | "reversibility" | "sideEffect">): PMFreakMateriality {
  if (input.actionClass === "ordinary_business_write" && input.risk === "low" && input.sideEffect === "internal" && input.reversibility === "reversible") return "ordinary";
  if (input.risk === "unknown" || input.reversibility === "unknown" || input.sideEffect === "unknown") return "unknown";
  return "material";
}

function canonicalProposal(input: PMFreakMaterialActionProposalInput, materiality: PMFreakMateriality) {
  return {
    schemaVersion: PMFREAK_MATERIAL_ACTION_SCHEMA_VERSION,
    actionId: required(input.actionId, "actionId"),
    workspaceId: required(input.workspaceId, "workspaceId"),
    projectId: required(input.projectId, "projectId"),
    originatingSubjectType: input.originatingSubjectType,
    originatingSubjectId: required(input.originatingSubjectId, "originatingSubjectId"),
    sourceCorrelationId: required(input.sourceCorrelationId, "sourceCorrelationId"),
    causationId: input.causationId?.trim() || null,
    evidenceReferenceIds: sortedUnique(input.evidenceReferenceIds),
    findingReferenceIds: sortedUnique(input.findingReferenceIds),
    recommendationReferenceIds: sortedUnique(input.recommendationReferenceIds),
    decisionReferenceId: input.decisionReferenceId?.trim() || null,
    actionClass: input.actionClass,
    actionType: required(input.actionType, "actionType"),
    targetResourceType: required(input.targetResourceType, "targetResourceType"),
    targetResourceId: required(input.targetResourceId, "targetResourceId"),
    intendedOperation: required(input.intendedOperation, "intendedOperation"),
    intendedEffect: required(input.intendedEffect, "intendedEffect"),
    materiality,
    risk: input.risk,
    reversibility: input.reversibility,
    sideEffect: input.sideEffect,
    proposedActorId: required(input.proposedActorId, "proposedActorId"),
    accountableActorId: required(input.accountableActorId, "accountableActorId"),
    requiredApprovalCount: input.requiredApprovalCount,
    justification: required(input.justification, "justification"),
    constraints: sortedUnique(input.constraints),
    obligationReferenceIds: sortedUnique(input.obligationReferenceIds),
    policySnapshotReference: input.policySnapshotReference?.trim() || null,
    grantReference: input.grantReference?.trim() || null,
    expiresAt: iso(input.expiresAt, "expiresAt"),
    createdAt: iso(input.createdAt, "createdAt"),
    idempotencyKey: required(input.idempotencyKey, "idempotencyKey"),
    fixture: input.fixture ?? null,
  };
}

export function createPMFreakMaterialActionProposal(input: PMFreakMaterialActionProposalInput): PMFreakMaterialActionProposal {
  if (!Number.isInteger(input.requiredApprovalCount) || input.requiredApprovalCount < 0) throw new Error("material_action_invalid:requiredApprovalCount");
  if (input.originatingSubjectType === "decision" && input.decisionReferenceId !== input.originatingSubjectId) throw new Error("material_action_invalid:decisionReferenceId");
  if (new Date(input.expiresAt) <= new Date(input.createdAt)) throw new Error("material_action_invalid:expiry");
  const materiality = classifyPMFreakMaterialAction(input);
  const canonical = canonicalProposal(input, materiality);
  const deterministicDigest = createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
  return Object.freeze({ ...input, ...canonical, evidenceReferenceIds: Object.freeze(canonical.evidenceReferenceIds), findingReferenceIds: Object.freeze(canonical.findingReferenceIds), recommendationReferenceIds: Object.freeze(canonical.recommendationReferenceIds), constraints: Object.freeze(canonical.constraints), obligationReferenceIds: Object.freeze(canonical.obligationReferenceIds), digestVersion: PMFREAK_MATERIAL_ACTION_DIGEST_VERSION, deterministicDigest, remoteDecisionWriteback: false, createsTask: false, dispatchesAction: false, executesAction: false }) as PMFreakMaterialActionProposal;
}

export function comparePMFreakMaterialActionReplay(existing: PMFreakMaterialActionProposal, candidate: PMFreakMaterialActionProposal): PMFreakMaterialActionReplayDisposition {
  if (existing.idempotencyKey !== candidate.idempotencyKey) return "distinct";
  return existing.deterministicDigest === candidate.deterministicDigest ? "replay" : "conflict";
}

export function evaluatePMFreakMaterialActionGovernance(proposal: PMFreakMaterialActionProposal, evidence: PMFreakMaterialActionGovernanceEvidence, now = new Date()): PMFreakMaterialActionGovernanceResult {
  let state = evidence.state;
  if (proposal.deterministicDigest.length !== 64) state = "degraded";
  else if (new Date(proposal.expiresAt) <= now) state = "expired";
  else if (evidence.validUntil && new Date(evidence.validUntil) <= now) state = "stale";
  else if (proposal.materiality !== "ordinary" && state === "not_required") state = "requires_review";
  else if (proposal.evidenceReferenceIds.length === 0 && state === "authorized") state = "requires_review";
  else if (proposal.materiality === "unknown" && state === "authorized") state = "requires_review";
  else if (proposal.materiality === "material" && state === "authorized" && !evidence.policyDecisionReference) state = "degraded";
  else if (proposal.requiredApprovalCount > evidence.approvalReferenceIds.length && state === "authorized") state = "requires_approval";
  const canCommitAction = proposal.materiality === "ordinary" ? state === "not_required" || state === "authorized" : state === "authorized";
  return Object.freeze({ schemaVersion: "pmfreak.material-action-governance-result.v1", actionId: proposal.actionId, proposalDigest: proposal.deterministicDigest, state, canCommitAction, canExecute: false, createsTask: false, remoteDecisionWriteback: false, evidence: Object.freeze({ ...evidence, obligationReferenceIds: Object.freeze(sortedUnique(evidence.obligationReferenceIds)), approvalReferenceIds: Object.freeze(sortedUnique(evidence.approvalReferenceIds)), reasonCodes: Object.freeze(sortedUnique(evidence.reasonCodes)) }) }) as PMFreakMaterialActionGovernanceResult;
}
