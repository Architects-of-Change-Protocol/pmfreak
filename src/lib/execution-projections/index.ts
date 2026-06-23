// ─────────────────────────────────────────────────────────────────────────────
// Execution Projection Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

export {
  generateExecutionProjection,
  validateExecutionProjection,
  approveExecutionProjection,
  rejectExecutionProjection,
  archiveExecutionProjection,
  getExecutionProjection,
  listExecutionProjections,
  getProjectionLineage,
  getProjectionReadiness,
  getProjectionExplanation,
  compareProjections,
} from "./projection-registry";

export { calculateProjectionEffort } from "./effort-engine";
export { calculateProjectionDependencies } from "./dependency-engine";
export { calculateProjectionParticipants } from "./participant-engine";
export { calculateProjectionRisk } from "./risk-engine";
export { calculateProjectionConfidence } from "./confidence-engine";
export { calculateExecutionReadiness } from "./readiness-engine";
export { getExecutionProjectionLineage } from "./lineage";
export { explainExecutionProjection } from "./explain";
export { compareExecutionProjections } from "./comparison-engine";
export { getProjectionTemplate } from "./projection-templates";

export type {
  ExecutionProjectionStatus,
  ExecutionProjectionRisk,
  ExecutionProjectionDependencyType,
  ExecutionProjectionResult,
  ExecutionProjectionEventType,
  GenerateProjectionInput,
  ValidateProjectionInput,
  ApproveProjectionInput,
  RejectProjectionInput,
  ArchiveProjectionInput,
  GetProjectionInput,
  ListProjectionsInput,
  ProjectionWithDetails,
  ProjectionEffortEstimate,
  ProjectionDependency,
  ProjectionParticipant,
  ProjectionRiskResult,
  ProjectionConfidenceResult,
  ProjectionReadinessResult,
  ProjectionLineage,
  ProjectionExplanation,
  ProjectionComparison,
  ProjectionTaskTemplate,
} from "./types";
