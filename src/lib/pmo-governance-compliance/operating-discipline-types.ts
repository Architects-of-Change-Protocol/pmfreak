// ─── PMO Governance Compliance — Operating Discipline Snapshot Types ──────────
//
// Read-model types for the PMO Operating Discipline Snapshot.
//
// This feature derives a governance compliance assessment from existing read
// aggregations (PMO Command Center + PM Operating Dossiers). It does NOT
// recalculate PM capacity or PM performance, and it does not mutate any record.
//
// NOTE: This file is intentionally separate from the existing governance
// compliance scoring module in this directory (constitution / authority /
// ratification). The two features share a directory but not their type space.
// ─────────────────────────────────────────────────────────────────────────────

// ── Freshness constants ───────────────────────────────────────────────────────

export const CAPACITY_SNAPSHOT_FRESHNESS_DAYS = 7;
export const PERFORMANCE_SNAPSHOT_FRESHNESS_DAYS = 7;

// ── Status / risk enums ───────────────────────────────────────────────────────

export type GovernanceComplianceStatus =
  | "excellent"
  | "compliant"
  | "watch"
  | "non_compliant"
  | "critical";

export type GovernanceComplianceRisk = "low" | "medium" | "high" | "critical";

export type ViolationSeverity = "low" | "medium" | "high" | "critical";

export type AssessmentDomain =
  | "pm_profile_completeness"
  | "assignment_hygiene"
  | "capacity_governance"
  | "performance_governance"
  | "evidence_readiness"
  | "intervention_readiness"
  | "dossier_completeness";

// ── Violation types ───────────────────────────────────────────────────────────

export type ViolationType =
  | "PM_PROFILE_MISSING"
  | "PM_ROLE_MISSING"
  | "PM_EXPERIENCE_LEVEL_MISSING"
  | "PM_ACTIVE_PROJECTS_LIMIT_MISSING"
  | "INACTIVE_PM_HAS_ACTIVE_ASSIGNMENTS"
  | "SUSPENDED_PM_HAS_ACTIVE_ASSIGNMENTS"
  | "ACTIVE_PM_WITH_NO_ASSIGNMENTS"
  | "INVALID_ASSIGNMENT_TYPE"
  | "PROJECT_WITHOUT_PRIMARY_PM"
  | "PROJECT_WITH_MULTIPLE_PRIMARY_PMS"
  | "OBSERVER_COUNTED_AS_CAPACITY"
  | "HISTORICAL_ASSIGNMENT_MISSING_REMOVED_AT"
  | "ASSIGNMENT_EVENT_MISSING"
  | "CAPACITY_SNAPSHOT_MISSING"
  | "CAPACITY_SNAPSHOT_STALE"
  | "NEAR_CAPACITY_WITHOUT_RECOMMENDATION"
  | "AT_CAPACITY_WITHOUT_RECOMMENDATION"
  | "OVERLOADED_WITHOUT_RECOMMENDATION"
  | "OVERLOADED_NOT_IN_ATTENTION_QUEUE"
  | "PERFORMANCE_SNAPSHOT_MISSING"
  | "PERFORMANCE_SNAPSHOT_STALE"
  | "WARNING_PM_WITHOUT_RECOMMENDATION"
  | "CRITICAL_PM_WITHOUT_RECOMMENDATION"
  | "HIGH_RISK_PM_NOT_IN_ATTENTION_QUEUE"
  | "PERFORMANCE_RISK_MISSING"
  | "SCORE_INTERPRETATION_MISSING"
  | "EVIDENCE_CONFIDENCE_MISSING"
  | "EVIDENCE_COMPLETENESS_MISSING"
  | "CONFIDENCE_LEVEL_MISSING"
  | "LOW_CONFIDENCE_WITHOUT_RECOMMENDATION"
  | "MISSING_SOURCES_NOT_RECORDED"
  | "NEUTRAL_BASELINE_DOMAINS_NOT_RECORDED"
  | "CRITICAL_PM_WITHOUT_TOP_RECOMMENDATION"
  | "CAPACITY_RISK_WITHOUT_TOP_RECOMMENDATION"
  | "PERFORMANCE_RISK_WITHOUT_TOP_RECOMMENDATION"
  | "INSUFFICIENT_EVIDENCE_WITHOUT_RECOMMENDATION"
  | "RECOMMENDATION_MISSING_SEVERITY"
  | "RECOMMENDATION_MISSING_SOURCE"
  | "RISKY_PM_NOT_IN_ATTENTION_QUEUE"
  | "DOSSIER_IDENTITY_MISSING"
  | "DOSSIER_PROFILE_SECTION_MISSING"
  | "DOSSIER_ASSIGNMENTS_MISSING"
  | "DOSSIER_CAPACITY_SECTION_MISSING"
  | "DOSSIER_PERFORMANCE_SECTION_MISSING"
  | "DOSSIER_EVIDENCE_SECTION_MISSING"
  | "DOSSIER_RECOMMENDATIONS_MISSING"
  | "DOSSIER_EVENT_TIMELINE_MISSING";

// ── Violation ─────────────────────────────────────────────────────────────────

export interface GovernanceViolation {
  violation_id: string;
  violation_type: ViolationType;
  severity: ViolationSeverity;
  domain: AssessmentDomain;
  pm_id?: string;
  pm_name?: string;
  project_id?: string;
  project_name?: string;
  message: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  detected_at: string;
}

// ── Recommendation ────────────────────────────────────────────────────────────

export interface GovernanceRecommendation {
  type: string;
  severity: ViolationSeverity;
  domain: AssessmentDomain;
  message: string;
  target_type?: string;
  target_id?: string;
  source: string;
  related_violation_types: ViolationType[];
}

// ── Domain assessment ─────────────────────────────────────────────────────────

export interface DomainAssessment {
  score: number;
  status: GovernanceComplianceStatus;
  risk: GovernanceComplianceRisk;
  violations_count: number;
  evidence: Record<string, unknown>;
  recommendations: GovernanceRecommendation[];
}

// ── Evidence summary ──────────────────────────────────────────────────────────

export interface GovernanceEvidence {
  source: string;
  generated_from: {
    pmo_command_center: boolean;
    pm_operating_dossiers: boolean;
    pm_registry: boolean;
    pm_capacity: boolean;
    pm_performance: boolean;
    platform_events: boolean;
  };
  counts: {
    total_pms: number;
    active_pms: number;
    pm_dossiers_evaluated: number;
    capacity_snapshots_present: number;
    performance_snapshots_present: number;
    evidence_confidence_present: number;
    violations_detected: number;
  };
  freshness: {
    capacity_snapshot_freshness_days: number;
    performance_snapshot_freshness_days: number;
  };
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface PMOGovernanceComplianceSnapshot {
  workspace_id: string;
  snapshot_id: string;
  generated_at: string;
  compliance_score: number;
  compliance_status: GovernanceComplianceStatus;
  compliance_risk: GovernanceComplianceRisk;
  summary: {
    total_violations: number;
    critical_violations: number;
    high_violations: number;
    medium_violations: number;
    low_violations: number;
    active_pms_evaluated: number;
    critical_override_triggered: boolean;
    critical_override_reasons: string[];
  };
  assessments: {
    pm_profile_completeness: DomainAssessment;
    assignment_hygiene: DomainAssessment;
    capacity_governance: DomainAssessment;
    performance_governance: DomainAssessment;
    evidence_readiness: DomainAssessment;
    intervention_readiness: DomainAssessment;
    dossier_completeness?: DomainAssessment;
  };
  violations: GovernanceViolation[];
  recommendations: GovernanceRecommendation[];
  evidence: GovernanceEvidence;
  source: "pmo_governance_compliance";
}

// ── Service input / result ────────────────────────────────────────────────────

export interface GeneratePMOGovernanceComplianceSnapshotInput {
  workspaceId: string;
  actorId?: string;
  generatedAt?: string;
}

export type PMOGovernanceComplianceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type PMOGovernanceComplianceEventType =
  "PMO_GOVERNANCE_COMPLIANCE_SNAPSHOT_GENERATED";

// ── Scoring weights (sum 1.0) ─────────────────────────────────────────────────

export const GOVERNANCE_COMPLIANCE_DOMAIN_WEIGHTS = {
  pm_profile_completeness: 0.15,
  assignment_hygiene: 0.2,
  capacity_governance: 0.2,
  performance_governance: 0.2,
  evidence_readiness: 0.15,
  intervention_readiness: 0.1,
} as const;
