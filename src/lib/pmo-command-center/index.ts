// ─── PMO Command Center ───────────────────────────────────────────────────────
// EPIC 6 Sprint 5: PMO Governance Intelligence — Executive Layer

export { generatePMOSnapshot, getPMOSnapshot, listPMOSnapshots } from "./pmo-registry";
export { generatePMODashboardModel, calculatePMOTrendsFromWorkspace } from "./pmo-dashboard";
export { getPMOLineage } from "./pmo-lineage";
export { explainPMOCommandCenter } from "./explain";

// Engines (pure functions — safe to export for testing or direct use)
export { calculatePMOHealth, classifyPMOStatus } from "./engines/pmo-health-engine";
export { calculateOrganizationalCapacity, calculateAvailableCapacityPercentage } from "./engines/organizational-capacity-engine";
export { calculateGovernanceMaturity } from "./engines/governance-maturity-engine";
export { calculatePMORiskIndex } from "./engines/pmo-risk-engine";
export { generateAttentionQueue } from "./engines/attention-queue-engine";
export { generateExecutiveRecommendations } from "./engines/recommendation-engine";
export { identifyPMOHotspots } from "./engines/hotspot-engine";
export { calculatePMOTrends } from "./engines/trend-engine";

// Types
export type {
  PMOCommandCenterResult,
  PMOCommandCenterEventType,
  PMOStatus,
  PMOAttentionPriority,
  PMOAttentionEntityType,
  PMORecommendationType,
  PMOImpactScore,
  PMOHealthInput,
  OrganizationalCapacityInput,
  GovernanceMaturityInput,
  PMORiskInput,
  PMSummary,
  ProjectSummary,
  PMOHotspot,
  PMOHotspotType,
  PMOTrend,
  PMOTrendDirection,
  AttentionItem,
  ExecutiveRecommendation,
  GeneratePMOSnapshotInput,
  GetPMOSnapshotInput,
  ListPMOSnapshotsInput,
  GetPMOLineageInput,
  PMODashboardModel,
  PMOSnapshotResult,
  PMOLineage,
} from "./types";

export type { PMOCommandCenterExplanation } from "./explain";

// ─── PM Dossier Read Aggregation ──────────────────────────────────────────────
export { getPMOCommandCenter } from "./pmo-command-center";

export type {
  PMOOperationalStatus,
  PMOExecutiveSummary,
  PMOPMCounts,
  PMOPMRef,
  PMOCapacityOverview,
  PMOPerformanceOverview,
  PMOEvidenceConfidenceOverview,
  PMOAttentionQueues,
  PMOAttentionItem,
  PMORecommendation,
  PMODossierRow,
  PMOEventTimelineItem,
  PMOCommandCenterView,
  GetPMOCommandCenterViewInput,
} from "./types";
