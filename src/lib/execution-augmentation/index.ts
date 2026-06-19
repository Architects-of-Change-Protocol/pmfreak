// ─────────────────────────────────────────────────────────────────────────────
// Execution Augmentation Layer — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ExecutionArtifactType,
  ExecutionAugmentation,
  AugmentationArtifact,
  AugmentationLineageEntry,
  AvailableArtifacts,
  ExecutionAugmentationExport,
  ExecutionAugmentationExplanation,
  AugmentationArtifactReason,
  AugmentationHealth,
  AugmentationResult,
  ExecutionAugmentationEventType,
} from "./types";

export { ALL_EXECUTION_ARTIFACT_TYPES } from "./types";

export {
  buildExecutionAugmentation,
  buildTaskAugmentation,
  buildDecisionAugmentation,
  buildDependencyAugmentation,
  buildRiskAugmentation,
  buildMilestoneAugmentation,
  buildBlockerAugmentation,
  buildEscalationAugmentation,
  buildStakeholderAugmentation,
  buildProjectAugmentation,
  buildPortfolioAugmentation,
  getAugmentationHealth,
} from "./augmentation-builder";

export { resolveArtifacts, resolveLineage } from "./augmentation-resolver";

export {
  exportExecutionAugmentation,
  explainExecutionAugmentation,
} from "./augmentation-export";
