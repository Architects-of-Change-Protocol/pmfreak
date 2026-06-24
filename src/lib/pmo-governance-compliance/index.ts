// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  GovernanceComplianceSnapshotRow,
  GovernanceComplianceGapRow,
  GovernanceComplianceEvidenceRow,
  GovernanceComplianceStatus,
  GovernanceComplianceDomain,
  GovernanceGapSeverity,
  GovernanceComplianceResult,
  GovernanceComplianceEventType,
  ConstitutionComplianceInput,
  AuthorityComplianceInput,
  RatificationComplianceInput,
  DecisionComplianceInput,
  ExecutionComplianceInput,
  LearningComplianceInput,
  OverallComplianceInput,
  GovernanceGap,
  GovernanceDebt,
  GovernanceHotspot,
  GenerateGovernanceComplianceSnapshotInput,
  GetGovernanceComplianceSnapshotInput,
  ListGovernanceComplianceSnapshotsInput,
  GenerateGovernanceScorecardInput,
  CompareGovernanceComplianceInput,
  GeneratePMOComplianceSummaryInput,
  GetGovernanceComplianceLineageInput,
  GovernanceScorecard,
  GovernanceComplianceComparison,
  PMOComplianceSummary,
  GovernanceComplianceLineage,
} from "./types";

export {
  GOVERNANCE_COMPLIANCE_WEIGHTS,
  GOVERNANCE_COMPLIANCE_STATUS_THRESHOLDS,
  GOVERNANCE_COMPLIANCE_STATUSES,
  GOVERNANCE_COMPLIANCE_DOMAINS,
  GOVERNANCE_GAP_SEVERITIES,
} from "./types";

// ─── Compliance Engines ───────────────────────────────────────────────────────
export { calculateConstitutionCompliance }  from "./engines/constitution-compliance";
export { calculateAuthorityCompliance }     from "./engines/authority-compliance";
export { calculateRatificationCompliance }  from "./engines/ratification-compliance";
export { calculateDecisionCompliance }      from "./engines/decision-compliance";
export { calculateExecutionCompliance }     from "./engines/execution-compliance";
export { calculateLearningCompliance }      from "./engines/learning-compliance";
export { calculateOverallCompliance }       from "./engines/overall-compliance";
export { classifyGovernanceComplianceStatus } from "./engines/status-classification";
export { detectGovernanceGaps }             from "./engines/gap-detection";
export { calculateGovernanceDebt }          from "./engines/debt-engine";
export { identifyGovernanceHotspots }       from "./engines/hotspot-engine";

// ─── Compliance Registry ──────────────────────────────────────────────────────
export {
  generateGovernanceComplianceSnapshot,
  getGovernanceComplianceSnapshot,
  listGovernanceComplianceSnapshots,
  listGovernanceComplianceGaps,
  listGovernanceComplianceEvidence,
} from "./compliance-registry";

// ─── Scorecard ────────────────────────────────────────────────────────────────
export { generateGovernanceScorecard, explainGovernanceScorecard } from "./scorecard";

// ─── Comparison ───────────────────────────────────────────────────────────────
export { compareGovernanceCompliance } from "./comparison";

// ─── PMO Summary ──────────────────────────────────────────────────────────────
export { generatePMOComplianceSummary } from "./pmo-summary";

// ─── Lineage ──────────────────────────────────────────────────────────────────
export { getGovernanceComplianceLineage } from "./lineage";

// ─── Explain ──────────────────────────────────────────────────────────────────
export { explainPMOGovernanceCompliance } from "./explain";
export type { PMOGovernanceComplianceExplanation } from "./explain";

// ─── PMO Operating Discipline Snapshot ────────────────────────────────────────
// PMO Operating Discipline compliance feature. Derives a compliance snapshot
// from the PMO Command Center view + PM Operating Dossiers. Read-only: it does
// NOT recalculate capacity or performance.
export {
  generatePMOGovernanceComplianceSnapshot,
  assembleSnapshot,
  classifyComplianceStatus,
  classifyDomainStatus,
  classifyDomainRisk,
  deriveComplianceRisk,
  evaluateCriticalOverride,
  buildRecommendations,
  buildDomainAssessment,
  detectProfileViolations,
  detectAssignmentViolations,
  detectCapacityViolations,
  detectPerformanceViolations,
  detectEvidenceViolations,
  detectInterventionViolations,
  detectDossierViolations,
} from "./operating-discipline";

export {
  CAPACITY_SNAPSHOT_FRESHNESS_DAYS,
  PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS,
  GOVERNANCE_COMPLIANCE_DOMAIN_WEIGHTS,
} from "./operating-discipline-types";

export type {
  // Status / risk enum used by the Operating Discipline snapshot. Aliased to
  // avoid colliding with the constitution-compliance GovernanceComplianceStatus.
  GovernanceComplianceStatus as OperatingDisciplineComplianceStatus,
  GovernanceComplianceRisk,
  ViolationSeverity,
  AssessmentDomain,
  ViolationType,
  GovernanceViolation,
  GovernanceRecommendation,
  DomainAssessment,
  GovernanceEvidence,
  PMOGovernanceComplianceSnapshot,
  GeneratePMOGovernanceComplianceSnapshotInput,
  PMOGovernanceComplianceResult,
  PMOGovernanceComplianceEventType,
} from "./operating-discipline-types";
