export const SIGNAL_TYPES = [
  "scope_creep", "schedule_risk", "cost_risk", "quality_risk", "stakeholder_blocker",
  "missing_approval", "decision_needed", "delivery_impediment", "billing_risk", "governance_gap",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];
export type Severity = "low" | "medium" | "high" | "critical";
export type DecisionStatus = "accepted" | "rejected" | "modified" | "escalated" | "needs_more_evidence";
export type EvidenceAssertionType = "FACT" | "INFERENCE" | "ASSUMPTION";
export type EvidenceClassification = "UNCLASSIFIED" | "PROJECT_STATUS" | "RISK" | "ISSUE" | "DECISION_CONTEXT" | "DELIVERY";
export type MissingDataState = "COMPLETE" | "PARTIAL" | "UNKNOWN";

export type DeriveEvidenceInput = {
  normalizedEventId: string;
  idempotencyKey: string;
  assertionType: EvidenceAssertionType;
  classification: EvidenceClassification;
  confidenceScore: number;
  missingDataState: MissingDataState;
  evaluatedAt: string;
  staleAt?: string | null;
};

export type EvidenceProvenanceResult = {
  disposition: "created" | "duplicate";
  source: Record<string, unknown>;
  rawInput: Record<string, unknown>;
  normalizedEvent: Record<string, unknown>;
  evidence: Record<string, unknown>;
  auditEventId?: string | null;
  intelligenceRan: false;
};

export type DetectedSignal = {
  signalType: SignalType;
  severity: Severity;
  confidenceScore: number;
  summary: string;
  rationale: string;
};

export type GovernanceEvaluation = {
  ruleKey: string;
  authorityRequired: string;
  evidenceRequired: boolean;
  governanceStatus: "compliant" | "warning" | "violation" | "decision_required";
  explanation: string;
};

export type OperationalAssuranceSummary = {
  scope: "project";
  workspaceId: string;
  projectId: string;
  asOf: string;
  totalGovernanceEvents: number;
  decisionRequiredCount: number;
  violationsCount: number;
  openRecommendations: number;
  unresolvedRisksIssues: number;
  evidenceLinkedDecisionsCount: number;
  evidenceWithoutSignalCount: number;
  incompleteChainCount: number;
};

export type CanonicalTaskOutcomeState =
  | "expected"
  | "observing"
  | "achieved"
  | "partially_achieved"
  | "not_achieved"
  | "disputed"
  | "inconclusive"
  | "superseded";

export type CanonicalOutcomeObservationState =
  | "achieved"
  | "partial"
  | "failed"
  | "disputed"
  | "inconclusive";

export type EnsureExpectedOutcomeInput = {
  taskId: string;
  expectedResult: string;
  successCriteria?: unknown[];
  correlationId: string;
  causationId?: string | null;
};

export type RecordOutcomeObservationInput = {
  outcomeId: string;
  observationState: CanonicalOutcomeObservationState;
  summary: string;
  evidenceReferenceIds: string[];
  confidenceScore: number;
  missingDataState: MissingDataState;
  observedAt: string;
  evaluatedAt: string;
  staleAt?: string | null;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey: string;
};

export type LineageStepKind =
  | "source"
  | "raw_input"
  | "normalized_event"
  | "evidence"
  | "finding"
  | "governance"
  | "recommendation"
  | "decision"
  | "material_action"
  | "task"
  | "internal_execution"
  | "outcome"
  | "observation";

export type LineageLinkRelationship =
  | "causation"
  | "correlation_only"
  | "direct_reference"
  | "unlinked";

export type LineageLinkStatus =
  | "intact"
  | "missing"
  | "disputed"
  | "inconclusive"
  | "degraded"
  | "fixture";

export type LineageStepNode = {
  kind: LineageStepKind;
  id: string | null;
  title: string;
  status: LineageLinkStatus;
  summary: string;
  entity: Record<string, unknown> | null;
  correlationId: string | null;
  causationId: string | null;
  isFixture: boolean;
  fixtureLabel: string | null;
  gapReason: string | null;
  occurredAt: string | null;
  recordedAt: string | null;
  actorId: string | null;
  evidenceAssertionType?: EvidenceAssertionType | null;
  confidenceScore?: number | null;
  missingDataState?: MissingDataState | null;
};

export type LineageTransition = {
  fromKind: LineageStepKind;
  toKind: LineageStepKind;
  relationship: LineageLinkRelationship;
  relationshipExplanation: string;
  isCausal: boolean;
  correlationId: string | null;
  causationId: string | null;
};

export type CompleteLineageProjection = {
  outcomeId: string;
  taskId: string;
  expectedResult: string;
  outcomeState: CanonicalTaskOutcomeState;
  observationsCount: number;
  latestObservationState: CanonicalOutcomeObservationState | null;
  lineageStatus: "complete" | "incomplete" | "disputed" | "inconclusive" | "degraded";
  hasCorrelationOnly: boolean;
  steps: LineageStepNode[];
  transitions: LineageTransition[];
  auditEvents: Record<string, unknown>[];
  gaps: string[];
  disputes: string[];
  isFixture: boolean;
  fixtureLabel: string | null;
};

export type AuditReconstructionItem = {
  id: string;
  eventType: string;
  eventCategory: string;
  actorId: string | null;
  actorType: string;
  occurredAt: string;
  recordedAt: string;
  correlationId: string | null;
  causationId: string | null;
  rawReferenceTable: string | null;
  rawReferenceId: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  relationship: "causation" | "correlation_only" | "unlinked";
};

export type OperationalSummary = {
  sources: Array<Record<string, unknown>>;
  rawInputs: Array<Record<string, unknown>>;
  normalizedEvents: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  signals: Array<Record<string, unknown>>;
  risksIssues: Array<Record<string, unknown>>;
  governanceEvents: Array<Record<string, unknown>>;
  recommendations: Array<Record<string, unknown>>;
  decisions: Array<Record<string, unknown>>;
  evidenceLinks: Array<Record<string, unknown>>;
  materialActions: Array<Record<string, unknown>>;
  materialActionEvaluations: Array<Record<string, unknown>>;
  outcomes?: Array<Record<string, unknown>>;
  observations?: Array<Record<string, unknown>>;
  lineages?: CompleteLineageProjection[];
  assurance: OperationalAssuranceSummary;
  actor: { role: string | null; canCreateEvidence: boolean };
};
