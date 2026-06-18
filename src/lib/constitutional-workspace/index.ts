// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Workspace Foundation — Public API
// ─────────────────────────────────────────────────────────────────────────────

export type {
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
  WorkspacePatternRecord,
  WorkspaceEffectivenessRecord,
  WorkspaceBriefType,
  WorkspaceBriefRecord,
  WorkspaceDashboardType,
  WorkspaceDashboardRecord,
  WorkspaceGovernanceArtifactType,
  WorkspaceGovernanceArtifact,
  ConstitutionalWorkspaceSummary,
  WorkspaceKnowledgeSummary,
  WorkspaceEvidenceSummary,
  WorkspaceBriefSummary,
  WorkspaceDashboardSummary,
  WorkspaceGovernanceSummary,
  WorkspaceLineage,
  WorkspaceCoverageMetrics,
  WorkspaceHealth,
  ConstitutionalWorkspace,
  ConstitutionalWorkspaceExport,
  WorkspaceArtifactReason,
  ConstitutionalWorkspaceExplanation,
  WorkspaceResult,
  ConstitutionalWorkspaceEventType,
} from "./types";

export {
  ALL_WORKSPACE_BRIEF_TYPES,
  ALL_WORKSPACE_DASHBOARD_TYPES,
  ALL_GOVERNANCE_ARTIFACT_TYPES,
} from "./types";

export {
  buildWorkspaceSummary,
  buildKnowledgeSummary,
  buildEvidenceSummary,
  buildBriefSummary,
  buildDashboardSummary,
  buildGovernanceSummary,
} from "./workspace-summary";

export {
  buildConstitutionalWorkspace,
  explainConstitutionalWorkspace,
  getWorkspaceHealth,
} from "./workspace-builder";

export { exportConstitutionalWorkspace } from "./workspace-export";
