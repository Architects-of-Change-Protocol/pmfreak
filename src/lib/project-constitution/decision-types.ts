import type {
  ConstitutionalDecisionAuthority,
  ConstitutionalDecisionEvidenceRow,
  ConstitutionalDecisionEvidenceType,
  ConstitutionalDecisionLinkRow,
  ConstitutionalDecisionLinkType,
  ConstitutionalDecisionOptionRow,
  ConstitutionalDecisionRow,
  ConstitutionalDecisionStatus,
  ConstitutionalDecisionType,
} from "@/lib/db/database-contract";
import type { ConstitutionalDecisionEventType } from "@/lib/platform-events/types";

export type {
  ConstitutionalDecisionAuthority,
  ConstitutionalDecisionEvidenceType,
  ConstitutionalDecisionLinkType,
  ConstitutionalDecisionStatus,
  ConstitutionalDecisionType,
};

export type DecisionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      failureClass:
        | "validation_failed"
        | "not_found"
        | "persistence_failed"
        | "event_emission_failed"
        | "governance_violation";
    };

export type DecisionRecord = ConstitutionalDecisionRow;
export type DecisionOptionRecord = ConstitutionalDecisionOptionRow;
export type DecisionEvidenceRecord = ConstitutionalDecisionEvidenceRow;
export type DecisionLinkRecord = ConstitutionalDecisionLinkRow;
export type DecisionEventName = ConstitutionalDecisionEventType;

// ─── Input types ──────────────────────────────────────────────────────────────

export type CreateDecisionInput = {
  workspaceId: string;
  constitutionId: string;
  title: string;
  description?: string | null;
  decisionType: ConstitutionalDecisionType;
  context?: string | null;
  problemStatement?: string | null;
  recommendedOption?: string | null;
  decisionAuthority: ConstitutionalDecisionAuthority;
  createdBy: string;
};

export type UpdateDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
  title?: string;
  description?: string | null;
  context?: string | null;
  problemStatement?: string | null;
  recommendedOption?: string | null;
};

export type AddDecisionOptionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
  name: string;
  description?: string | null;
  advantages?: string | null;
  disadvantages?: string | null;
  estimatedCost?: string | null;
  estimatedEffort?: string | null;
};

export type SelectDecisionOptionInput = {
  decisionId: string;
  optionId: string;
  workspaceId: string;
  actorId: string;
};

export type AttachDecisionEvidenceInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
  evidenceType: ConstitutionalDecisionEvidenceType;
  referenceId?: string | null;
  description: string;
};

export type LinkDecisionEntityInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
  linkType: ConstitutionalDecisionLinkType;
  linkedEntityId: string;
};

export type ProposeDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
};

export type ApproveDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
};

export type RejectDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
};

export type ExecuteDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
};

export type CancelDecisionInput = {
  decisionId: string;
  workspaceId: string;
  actorId: string;
};

// ─── Decision Timeline ────────────────────────────────────────────────────────

export type DecisionTimelineEntry = {
  date: string;
  actor: string | null;
  action: string;
  status: ConstitutionalDecisionStatus;
  comment: string | null;
};

// ─── Decision Register Filters ────────────────────────────────────────────────

export type ListDecisionsInput = {
  workspaceId: string;
  constitutionId?: string;
  status?: ConstitutionalDecisionStatus;
  decisionType?: ConstitutionalDecisionType;
  decisionAuthority?: ConstitutionalDecisionAuthority;
  fromDate?: string;
  toDate?: string;
};

// ─── Impact Analysis ──────────────────────────────────────────────────────────

export type DecisionImpactAnalysis = {
  decisionId: string;
  affectedObjectives: DecisionLinkRecord[];
  affectedConstraints: DecisionLinkRecord[];
  relatedRisks: DecisionLinkRecord[];
  relatedAmendments: DecisionLinkRecord[];
  relatedDeliverables: DecisionLinkRecord[];
  relatedMilestones: DecisionLinkRecord[];
  totalImpactedEntities: number;
};

// ─── Decision Lineage ─────────────────────────────────────────────────────────

export type DecisionLineage = {
  decision: DecisionRecord;
  options: DecisionOptionRecord[];
  evidence: DecisionEvidenceRecord[];
  links: DecisionLinkRecord[];
  timeline: DecisionTimelineEntry[];
};

// ─── Explain Capability ───────────────────────────────────────────────────────

export type DecisionStateDescription = {
  status: ConstitutionalDecisionStatus;
  label: string;
  description: string;
  terminal: boolean;
  allowedTransitions: ConstitutionalDecisionStatus[];
};

export type ConstitutionalDecisionGovernanceExplanation = {
  whatIsAConstitutionalDecision: string;
  decisionAuthorities: string[];
  evidenceTypes: string[];
  linkTypes: string[];
  traceability: string;
  amendmentIntegration: string;
  constitutionIntegration: string;
  states: DecisionStateDescription[];
  terminalStates: ConstitutionalDecisionStatus[];
  auditEvents: DecisionEventName[];
  governanceRules: string[];
};
