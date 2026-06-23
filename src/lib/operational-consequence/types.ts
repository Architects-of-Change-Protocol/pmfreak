import type {
  OperationalConsequenceRow,
  OperationalConsequenceImpactRow,
  OperationalConsequencePathRow,
  OperationalConsequenceScenarioRow,
  ConsequenceSeverity,
  ConsequenceImpactHorizon,
  ConsequenceAnalysisStatus,
  ConsequenceImpactType,
  ConsequenceScenarioName,
} from "@/lib/db/database-contract";

export type {
  OperationalConsequenceRow,
  OperationalConsequenceImpactRow,
  OperationalConsequencePathRow,
  OperationalConsequenceScenarioRow,
  ConsequenceSeverity,
  ConsequenceImpactHorizon,
  ConsequenceAnalysisStatus,
  ConsequenceImpactType,
  ConsequenceScenarioName,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const CONSEQUENCE_SEVERITIES: ConsequenceSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
  "systemic",
];

export const CONSEQUENCE_IMPACT_HORIZONS: ConsequenceImpactHorizon[] = [
  "24h",
  "48h",
  "7d",
  "14d",
  "30d",
  "90d",
];

export const CONSEQUENCE_ANALYSIS_STATUSES: ConsequenceAnalysisStatus[] = [
  "generated",
  "validated",
  "archived",
];

export const CONSEQUENCE_IMPACT_TYPES: ConsequenceImpactType[] = [
  "governance",
  "execution",
  "authority",
  "ratification",
  "commitment",
  "projection",
  "reality",
  "recommendation",
  "risk",
  "health",
];

export const CONSEQUENCE_SCENARIO_NAMES: ConsequenceScenarioName[] = [
  "best_case",
  "expected_case",
  "worst_case",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type ConsequenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type ConsequenceEventType =
  | "OPERATIONAL_CONSEQUENCE_GENERATED"
  | "OPERATIONAL_CONSEQUENCE_VALIDATED"
  | "OPERATIONAL_CONSEQUENCE_ARCHIVED"
  | "OPERATIONAL_IMPACT_SCORE_CALCULATED"
  | "OPERATIONAL_ESCALATION_PROBABILITY_CALCULATED"
  | "OPERATIONAL_CASCADE_ANALYZED"
  | "OPERATIONAL_SCENARIO_GENERATED"
  | "OPERATIONAL_DECISION_SUPPORT_GENERATED"
  | "OPERATIONAL_CONSEQUENCE_LINEAGE_GENERATED";

// ─── Impact Calculation Input ─────────────────────────────────────────────────

export type ImpactCalculationInput = {
  focusScore: number;
  operationalPriority: string;
  dependencyCount: number;
  governanceImpact: number;
  executionImpact: number;
  historicalSimilarity: number;
};

// ─── Cascade Node ─────────────────────────────────────────────────────────────

export type CascadeNode = {
  entityType: string;
  entityId: string;
  label: string;
  depth: number;
  children: CascadeNode[];
};

export type CascadeEffect = {
  chain: CascadeNode[];
  maxDepth: number;
  totalAffectedEntities: number;
};

// ─── Scenario ─────────────────────────────────────────────────────────────────

export type ConsequenceScenario = {
  name: ConsequenceScenarioName;
  description: string;
  probability: number;
};

// ─── Decision Support ────────────────────────────────────────────────────────

export type DecisionSupport = {
  focusItemId: string;
  focusType: string;
  recommendedAction: string;
  impactIfIgnored: ConsequenceSeverity;
  blockedEntityCount: number;
  escalationProbability: number;
  impactHorizon: ConsequenceImpactHorizon;
  rationale: string;
};

// ─── Consequence Lineage ─────────────────────────────────────────────────────

export type ConsequenceLineageLayer = {
  layer:
    | "constitution"
    | "memory"
    | "learning"
    | "recommendation"
    | "signal"
    | "action"
    | "commitment"
    | "projection"
    | "reality"
    | "snapshot"
    | "command_center"
    | "focus_item"
    | "consequence_analysis";
  entityType: string;
  entityId: string | null;
  label: string;
  count: number;
};

export type ConsequenceLineage = {
  focusItemId: string;
  consequenceId: string;
  workspaceId: string;
  chain: ConsequenceLineageLayer[];
  generatedAt: string;
};

// ─── Full Consequence Analysis ────────────────────────────────────────────────

export type ConsequenceAnalysis = {
  consequence: OperationalConsequenceRow;
  impacts: OperationalConsequenceImpactRow[];
  paths: OperationalConsequencePathRow[];
  scenarios: OperationalConsequenceScenarioRow[];
  decisionSupport: DecisionSupport;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateConsequenceInput = {
  workspaceId: string;
  focusItemId: string;
  actorId: string;
};

export type GetConsequenceInput = {
  workspaceId: string;
  consequenceId: string;
};

export type ListConsequencesInput = {
  workspaceId: string;
  focusItemId?: string;
  severity?: ConsequenceSeverity;
  analysisStatus?: ConsequenceAnalysisStatus;
  minImpactScore?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type ValidateConsequenceInput = {
  workspaceId: string;
  consequenceId: string;
  actorId: string;
};

export type ArchiveConsequenceInput = {
  workspaceId: string;
  consequenceId: string;
  actorId: string;
};

export type GetConsequenceLineageInput = {
  workspaceId: string;
  consequenceId: string;
  actorId: string;
};

export type ExplainConsequenceInput = {
  workspaceId: string;
  consequenceId: string;
};
