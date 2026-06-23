import type {
  OperationalDecisionRow,
  OperationalDecisionOptionRow,
  OperationalDecisionEvaluationRow,
  OperationalDecisionTradeoffRow,
  DecisionCategory,
  DecisionStatus,
  DecisionOptionType,
  DecisionEffortLevel,
  DecisionRiskLevel,
  DecisionTradeoffType,
} from "@/lib/db/database-contract";

export type {
  OperationalDecisionRow,
  OperationalDecisionOptionRow,
  OperationalDecisionEvaluationRow,
  OperationalDecisionTradeoffRow,
  DecisionCategory,
  DecisionStatus,
  DecisionOptionType,
  DecisionEffortLevel,
  DecisionRiskLevel,
  DecisionTradeoffType,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const DECISION_CATEGORIES: DecisionCategory[] = [
  "governance",
  "authority",
  "ratification",
  "execution",
  "commitment",
  "risk",
  "resource",
  "escalation",
  "projection",
  "portfolio",
];

export const DECISION_STATUSES: DecisionStatus[] = [
  "generated",
  "evaluated",
  "recommended",
  "accepted",
  "rejected",
  "archived",
];

export const DECISION_OPTION_TYPES: DecisionOptionType[] = [
  "governance",
  "authority",
  "execution",
  "commitment",
  "escalation",
  "resource",
  "risk",
  "structural",
];

export const DECISION_TRADEOFF_TYPES: DecisionTradeoffType[] = ["pro", "con"];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type DecisionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type DecisionEventType =
  | "OPERATIONAL_DECISION_GENERATED"
  | "OPERATIONAL_DECISION_EVALUATED"
  | "OPERATIONAL_DECISION_RECOMMENDED"
  | "OPERATIONAL_DECISION_ACCEPTED"
  | "OPERATIONAL_DECISION_REJECTED"
  | "OPERATIONAL_DECISION_ARCHIVED"
  | "OPERATIONAL_DECISION_SCORE_CALCULATED"
  | "OPERATIONAL_DECISION_CONFIDENCE_CALCULATED"
  | "OPERATIONAL_DECISION_TRADEOFF_ANALYZED"
  | "OPERATIONAL_DECISION_LINEAGE_GENERATED";

// ─── Alternative Generation ───────────────────────────────────────────────────

export type DecisionAlternative = {
  optionName: string;
  optionDescription: string;
  optionType: DecisionOptionType;
  pros: string[];
  cons: string[];
  estimatedEffort: DecisionEffortLevel;
  estimatedRisk: DecisionRiskLevel;
};

// ─── Evaluation ───────────────────────────────────────────────────────────────

export type DecisionEvaluationInput = {
  alternative: DecisionAlternative;
  consequenceSeverity: string;
  escalationProbability: number;
  impactScore: number;
};

export type DecisionEvaluationScores = {
  governanceScore: number;
  executionScore: number;
  riskScore: number;
  healthScore: number;
  overallScore: number;
};

// ─── Tradeoff ─────────────────────────────────────────────────────────────────

export type DecisionTradeoff = {
  tradeoffType: DecisionTradeoffType;
  description: string;
  impactScore: number;
};

// ─── Recommendation ───────────────────────────────────────────────────────────

export type DecisionRecommendation = {
  optionName: string;
  score: number;
  confidence: number;
  rationale: string;
};

// ─── Comparative Analysis ─────────────────────────────────────────────────────

export type OptionComparison = {
  optionName: string;
  score: number;
  rank: number;
  scoreDifferenceFromTop: number;
};

export type DecisionComparativeAnalysis = {
  ranked: OptionComparison[];
  topOption: string;
  spread: number;
};

// ─── Decision Support ─────────────────────────────────────────────────────────

export type OperationalDecisionSupport = {
  decisionId: string;
  recommendedOption: string;
  because: string[];
  confidence: number;
  score: number;
};

// ─── Decision Lineage ─────────────────────────────────────────────────────────

export type DecisionLineageLayer = {
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
    | "consequence_analysis"
    | "decision";
  entityType: string;
  entityId: string | null;
  label: string;
  count: number;
};

export type OperationalDecisionLineage = {
  decisionId: string;
  consequenceId: string;
  workspaceId: string;
  chain: DecisionLineageLayer[];
  generatedAt: string;
};

// ─── Full Decision Analysis ───────────────────────────────────────────────────

export type OperationalDecisionAnalysis = {
  decision: OperationalDecisionRow;
  options: OperationalDecisionOptionRow[];
  evaluations: OperationalDecisionEvaluationRow[];
  tradeoffs: OperationalDecisionTradeoffRow[];
  recommendation: DecisionRecommendation;
  comparative: DecisionComparativeAnalysis;
  support: OperationalDecisionSupport;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateDecisionInput = {
  workspaceId: string;
  consequenceId: string;
  actorId: string;
};

export type GetDecisionInput = {
  workspaceId: string;
  decisionId: string;
};

export type ListDecisionsInput = {
  workspaceId: string;
  consequenceId?: string;
  decisionCategory?: DecisionCategory;
  decisionStatus?: DecisionStatus;
  minScore?: number;
  minConfidence?: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type ValidateDecisionInput = {
  workspaceId: string;
  decisionId: string;
  actorId: string;
};

export type ArchiveDecisionInput = {
  workspaceId: string;
  decisionId: string;
  actorId: string;
};

export type GetDecisionLineageInput = {
  workspaceId: string;
  decisionId: string;
  actorId: string;
};

export type ExplainDecisionInput = {
  workspaceId: string;
  decisionId: string;
};
