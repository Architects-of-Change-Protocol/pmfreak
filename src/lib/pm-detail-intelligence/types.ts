// ─── PM Detail Intelligence — Types ──────────────────────────────────────────
//
// Read-model types for the PM Operating Dossier.
// This module aggregates existing domain data; it does not own scoring logic.
// ─────────────────────────────────────────────────────────────────────────────

// ── Operational Status ────────────────────────────────────────────────────────

export type PMOperationalStatus =
  | "healthy"
  | "watch"
  | "capacity_risk"
  | "performance_risk"
  | "insufficient_evidence"
  | "critical";

// ── PM Identity ───────────────────────────────────────────────────────────────

export type PMDossierIdentity = {
  pm_id: string;
  workspace_id: string;
  display_name: string;
  email: string;
  status: string;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── PM Profile ────────────────────────────────────────────────────────────────

export type PMDossierProfilePresent = {
  present: true;
  role: string;
  experience_level: string;
  capacity_limit: number;
  active_projects_limit: number;
  created_at: string;
  updated_at: string;
};

export type PMDossierProfileAbsent = {
  present: false;
  message: string;
};

export type PMDossierProfile = PMDossierProfilePresent | PMDossierProfileAbsent;

// ── Assignments ───────────────────────────────────────────────────────────────

export type PMDossierAssignmentRow = {
  assignment_id: string;
  project_id: string;
  project_name: string | null;
  project_status: string | null;
  assignment_type: string;
  assigned_at: string;
  removed_at: string | null;
  capacity_counted: boolean;
};

export type PMDossierAssignments = {
  active: PMDossierAssignmentRow[];
  historical: PMDossierAssignmentRow[];
  by_type: {
    primary: PMDossierAssignmentRow[];
    secondary: PMDossierAssignmentRow[];
    program: PMDossierAssignmentRow[];
    observer: PMDossierAssignmentRow[];
  };
  counts: {
    active_total: number;
    historical_total: number;
    primary: number;
    secondary: number;
    program: number;
    observer: number;
  };
};

// ── Executive Summary ─────────────────────────────────────────────────────────

export type PMExecutiveSummary = {
  pm_name: string;
  pm_status: string;
  role: string | null;
  experience_level: string | null;
  active_assignment_count: number;
  counted_assignment_count: number;
  capacity_status: string | null;
  overload_risk: string | null;
  performance_status: string | null;
  performance_risk: string | null;
  evidence_confidence_level: string | null;
  evidence_completeness: number | null;
  operational_status: PMOperationalStatus;
  top_recommendation: string | null;
  last_capacity_generated_at: string | null;
  last_performance_generated_at: string | null;
};

// ── Capacity Section ──────────────────────────────────────────────────────────

export type PMDossierCapacityPresent = {
  present: true;
  snapshot_id: string;
  generated_at: string;
  capacity_status: string;
  overload_risk: string;
  active_projects_limit: number | null;
  active_assignment_count: number | null;
  counted_assignment_count: number | null;
  observer_assignment_count: number | null;
  capacity_utilization: number | null;
  assignment_breakdown: Record<string, number> | null;
  recommendations: Array<{ type: string; severity: string; message: string }>;
  source: "pm_capacity";
};

export type PMDossierCapacityAbsent = {
  present: false;
  message: string;
};

export type PMDossierCapacity = PMDossierCapacityPresent | PMDossierCapacityAbsent;

// ── Performance Section ───────────────────────────────────────────────────────

export type PMDossierPerformancePresent = {
  present: true;
  snapshot_id: string;
  generated_at: string;
  overall_performance_score: number;
  performance_status: string;
  performance_risk: string | null;
  assigned_project_count: number | null;
  active_project_count: number | null;
  governance_score: number;
  execution_score: number;
  prediction_score: number;
  decision_score: number;
  portfolio_score: number;
  capacity_context: Record<string, unknown> | null;
  recommendations: string[];
  source: "pm_performance";
};

export type PMDossierPerformanceAbsent = {
  present: false;
  message: string;
};

export type PMDossierPerformance = PMDossierPerformancePresent | PMDossierPerformanceAbsent;

// ── Evidence Confidence ───────────────────────────────────────────────────────

export type PMDossierEvidencePresent = {
  present: true;
  evidence_completeness: number;
  confidence_level: string;
  available_source_count: number;
  missing_source_count: number;
  total_source_count: number;
  available_sources: string[];
  missing_sources: string[];
  neutral_baseline_domains: string[];
  score_interpretation: string;
  missing_source_policy: string | null;
  confidence_recommendations: Array<{ type: string; severity: string; message: string }>;
  warning?: string;
};

export type PMDossierEvidenceAbsent = {
  present: false;
  message: string;
};

export type PMDossierEvidence = PMDossierEvidencePresent | PMDossierEvidenceAbsent;

// ── Project Breakdown ─────────────────────────────────────────────────────────

export type PMProjectBreakdownRow = {
  project_id: string;
  project_name: string | null;
  project_status: string | null;
  assignment_type: string;
  assigned_at: string;
  removed_at: string | null;
  active: boolean;
  capacity_counted: boolean;
  latest_health_status: string;
  performance_contribution: string;
  evidence_status: "evidence_available" | "partial_evidence" | "not_enough_data";
};

// ── Recommendations ───────────────────────────────────────────────────────────

export type PMDossierRecommendationSeverity = "critical" | "high" | "medium" | "low";

export type PMDossierRecommendation = {
  type: string;
  severity: PMDossierRecommendationSeverity;
  message: string;
  source: "pm_capacity" | "pm_performance" | "evidence_confidence" | "pm_detail_intelligence";
};

// ── Event Timeline ────────────────────────────────────────────────────────────

export type PMEventTimelineItem = {
  event_type: string;
  occurred_at: string;
  actor_user_id: string | null;
  source: string;
  summary: string;
  payload_excerpt: Record<string, unknown>;
};

// ── Actions ───────────────────────────────────────────────────────────────────

export type PMDossierAction = {
  type: string;
  label: string;
  href?: string;
  api_endpoint?: string;
  method?: string;
};

// ── Operating Dossier ─────────────────────────────────────────────────────────

export type PMOperatingDossier = {
  pm: PMDossierIdentity;
  profile: PMDossierProfile;
  executive_summary: PMExecutiveSummary;
  assignments: PMDossierAssignments;
  capacity: PMDossierCapacity;
  performance: PMDossierPerformance;
  evidence_confidence: PMDossierEvidence;
  project_breakdown: PMProjectBreakdownRow[];
  recommendations: PMDossierRecommendation[];
  event_timeline: PMEventTimelineItem[];
  actions: PMDossierAction[];
  generated_at: string;
};

// ── Service Input ─────────────────────────────────────────────────────────────

export type GetPMOperatingDossierInput = {
  workspaceId: string;
  pmId: string;
  actorId?: string;
};

export type PMDetailIntelligenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };
