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
