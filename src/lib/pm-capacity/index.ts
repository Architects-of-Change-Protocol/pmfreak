// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  PMCapacitySnapshotRow,
  PMCapacityMetricRow,
  PMCapacityEvidenceRow,
  PMCapacityStatus,
  PMBurnRisk,
  PMCapacityResult,
  PMCapacityEventType,
  PMCapacityDomain,
  CalculatePMCapacityInput,
  CalculatePMLoadInput,
  CalculatePMUtilizationInput,
  CalculatePMBurnRiskInput,
  DetectPMOverloadInput,
  GenerateCapacityRecommendationsInput,
  GeneratePMCapacitySnapshotInput,
  GenerateWorkspacePMCapacitySnapshotsInput,
  GetPMCapacitySnapshotInput,
  ListPMCapacitySnapshotsInput,
  ListLatestPMCapacitySnapshotsInput,
  ListOverloadedProjectManagersInput,
  AssignmentCapacityStatus,
  AssignmentOverloadRisk,
  AssignmentCapacityRecommendation,
  AssignmentCapacityEvidence,
  AssignmentBreakdown,
  AssignmentCapacityPayload,
  GeneratePMCapacityProfileInput,
  ComparePMCapacityInput,
  GetPMCapacityLineageInput,
  PMCapacityProfile,
  PMCapacityComparison,
  PMCapacityLineage,
} from "./types";

export {
  PM_CAPACITY_STATUS_THRESHOLDS,
  PM_BURN_RISK_THRESHOLDS,
  PM_CAPACITY_STATUSES,
  PM_BURN_RISK_LEVELS,
} from "./types";

// ─── Engines ──────────────────────────────────────────────────────────────────
export { calculatePMCapacity }              from "./engines/capacity-engine";
export { calculatePMLoad }                  from "./engines/load-engine";
export { calculatePMUtilization }           from "./engines/utilization-engine";
export { calculatePMBurnRisk }              from "./engines/burn-risk-engine";
export { detectPMOverload }                 from "./engines/overload-detection";
export { generateCapacityRecommendations }  from "./engines/recommendation-engine";
export type { CapacityRecommendation }      from "./engines/recommendation-engine";

// ─── Capacity Registry ────────────────────────────────────────────────────────
export {
  generatePMCapacitySnapshot,
  generateWorkspacePMCapacitySnapshots,
  getPMCapacitySnapshot,
  listPMCapacitySnapshots,
  listLatestPMCapacitySnapshots,
  listOverloadedProjectManagers,
} from "./capacity-registry";

// ─── Capacity Profile ─────────────────────────────────────────────────────────
export { generatePMCapacityProfile } from "./capacity-profile";

// ─── Comparison ───────────────────────────────────────────────────────────────
export { comparePMCapacity } from "./comparison";

// ─── Lineage ──────────────────────────────────────────────────────────────────
export { getPMCapacityLineage } from "./lineage";

// ─── Explain ──────────────────────────────────────────────────────────────────
export { explainPMCapacityEngine } from "./explain";
export type { PMCapacityEngineExplanation } from "./explain";
