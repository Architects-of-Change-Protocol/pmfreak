// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  PMPerformanceSnapshotRow,
  PMPerformanceMetricRow,
  PMPerformanceEvidenceRow,
  PMPerformanceStatus,
  PMPerformanceDomain,
  PMPerformanceMetricStatus,
  PMPerformanceResult,
  PMPerformanceEventType,
  GovernanceScoreInput,
  ExecutionScoreInput,
  PredictionAccuracyInput,
  DecisionEffectivenessInput,
  PortfolioHealthInput,
  OverallPerformanceInput,
  GeneratePMPerformanceSnapshotInput,
  GetPMPerformanceSnapshotInput,
  ListPMPerformanceSnapshotsInput,
  GeneratePMScorecardInput,
  ComparePMPerformanceInput,
  GetPMPerformanceLineageInput,
  PMScorecard,
  PMPerformanceComparison,
  PMPerformanceLineage,
} from "./types";

export {
  PM_PERFORMANCE_WEIGHTS,
  PM_PERFORMANCE_STATUS_THRESHOLDS,
  PM_PERFORMANCE_STATUSES,
  PM_PERFORMANCE_DOMAINS,
} from "./types";

// ─── Score Engines ────────────────────────────────────────────────────────────
export { calculatePMGovernanceScore }    from "./engines/governance-score";
export { calculatePMExecutionScore }     from "./engines/execution-score";
export { calculatePMPredictionAccuracy } from "./engines/prediction-accuracy";
export { calculatePMDecisionEffectiveness } from "./engines/decision-effectiveness";
export { calculatePMPortfolioHealth }    from "./engines/portfolio-health";
export { calculatePMOverallPerformance } from "./engines/overall-performance";
export { classifyPMPerformanceStatus }   from "./engines/status-classification";

// ─── Performance Registry ─────────────────────────────────────────────────────
export {
  generatePMPerformanceSnapshot,
  getPMPerformanceSnapshot,
  listPMPerformanceSnapshots,
} from "./performance-registry";

// ─── Scorecard ────────────────────────────────────────────────────────────────
export { generatePMScorecard, explainPMScorecard } from "./scorecard";

// ─── Comparison ───────────────────────────────────────────────────────────────
export { comparePMPerformance } from "./comparison";

// ─── Lineage ──────────────────────────────────────────────────────────────────
export { getPMPerformanceLineage } from "./lineage";

// ─── Explain ──────────────────────────────────────────────────────────────────
export { explainPMPerformanceEngine } from "./explain";
export type { PMPerformanceEngineExplanation } from "./explain";
