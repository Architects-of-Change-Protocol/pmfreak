// ─── Service Functions ────────────────────────────────────────────────────────

export {
  generateProjectOSSnapshot,
  getProjectOSSnapshot,
  listProjectOSSnapshots,
  validateProjectOSSnapshot,
  archiveProjectOSSnapshot,
  generateProjectAttentionItems,
  getProjectOperatingContext,
  getProjectOSLineageForProject,
} from "./project-os-registry";

// ─── Engines ──────────────────────────────────────────────────────────────────

export {
  calculateGovernanceOSHealth,
  calculateExecutionOSHealth,
  calculateMemoryOSHealth,
  calculateRecommendationOSHealth,
  calculateProjectOperatingHealth,
} from "./health-engine";

export { detectProjectAttentionItems } from "./attention-engine";

export { composeProjectOperatingContext } from "./context-engine";

export { getProjectOSLineage } from "./lineage-engine";

export { explainProjectOperatingSystem } from "./explain";

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  ProjectOSSnapshotRow,
  ProjectOSAttentionItemRow,
  ProjectOSContextLinkRow,
  ProjectOSAttentionType,
  ProjectOSAttentionSeverity,
  ProjectOSSnapshotStatus,
  ProjectOSResult,
  ProjectOSEventType,
  ProjectOSConstitutionSummary,
  ProjectOSGovernanceSummary,
  ProjectOSExecutionSummary,
  ProjectOSMemorySummary,
  ProjectOSRecommendationSummary,
  ProjectOSSnapshotPayload,
  ProjectOSHealthScore,
  DetectedAttentionItem,
  ProjectOSOperatingContext,
  ProjectOSLineageLayer,
  ProjectOSLineage,
  GenerateProjectOSSnapshotInput,
  GetProjectOSSnapshotInput,
  ListProjectOSSnapshotsInput,
  ValidateProjectOSSnapshotInput,
  ArchiveProjectOSSnapshotInput,
  GetProjectOperatingContextInput,
  GetProjectOSLineageInput,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

export {
  PROJECT_OS_SNAPSHOT_STATUSES,
  PROJECT_OS_ATTENTION_TYPES,
  PROJECT_OS_ATTENTION_SEVERITIES,
} from "./types";
