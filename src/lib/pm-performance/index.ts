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
  PMPerformanceRisk,
  GovernanceScoreInput,
  ExecutionScoreInput,
  PredictionAccuracyInput,
  DecisionEffectivenessInput,
  PortfolioHealthInput,
  OverallPerformanceInput,
  GeneratePMPerformanceSnapshotInput,
  GetPMPerformanceSnapshotInput,
  ListPMPerformanceSnapshotsInput,
  GenerateWorkspacePMPerformanceSnapshotsInput,
  GetLatestPMPerformanceSnapshotInput,
  ListLatestPMPerformanceSnapshotsInput,
  ListAtRiskPMPerformanceSnapshotsInput,
  GeneratePMScorecardInput,
  ComparePMPerformanceInput,
  GetPMPerformanceLineageInput,
  PMScorecard,
  PMPerformanceComparison,
  PMPerformanceLineage,
  ConfidenceLevel,
  ScoreInterpretation,
  EvidenceConfidence,
  EvidenceSourceAvailability,
} from "./types";

export {
  PM_PERFORMANCE_WEIGHTS,
  PM_PERFORMANCE_STATUS_THRESHOLDS,
  PM_PERFORMANCE_RISK_THRESHOLDS,
  PM_PERFORMANCE_STATUSES,
  PM_PERFORMANCE_DOMAINS,
  calculateEvidenceConfidence,
  deriveConfidenceRecommendations,
  EVIDENCE_TOTAL_SOURCE_COUNT,
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
  generateWorkspacePMPerformanceSnapshots,
  getPMPerformanceSnapshot,
  getLatestPMPerformanceSnapshot,
  listPMPerformanceSnapshots,
  listLatestPMPerformanceSnapshots,
  listAtRiskPMPerformanceSnapshots,
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
