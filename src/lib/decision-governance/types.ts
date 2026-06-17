import type { PlatformEventRow } from "@/lib/platform-events";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" | "governance_violation" };

export type DecisionStatus = "draft" | "pending_review" | "approved" | "rejected" | "implemented" | "expired";
export type DecisionType = "risk_response" | "scope_change" | "schedule_change" | "budget_change" | "resource_change" | "stakeholder_action" | "governance_exception" | "vendor_action" | "dependency_resolution" | "other";
export type DecisionEvidenceRelationship = "supports" | "contradicts" | "required_for" | "reviewed_during" | "triggered_by";
export type DecisionLifecycleEvent = "DECISION_CREATED" | "DECISION_SUBMITTED" | "DECISION_APPROVED" | "DECISION_REJECTED" | "DECISION_IMPLEMENTED" | "DECISION_EXPIRED" | "DECISION_IMPLEMENTATION_RECORDED" | "DECISION_OUTCOME_RECORDED" | "DECISION_OUTCOME_SUCCESS" | "DECISION_OUTCOME_PARTIAL_SUCCESS" | "DECISION_OUTCOME_FAILURE";

export type DecisionRecord = {
  id: string;
  workspace_id: string;
  project_id: string;
  decision_type: DecisionType;
  decision_status: DecisionStatus;
  title: string;
  summary: string;
  decision_rationale: string | null;
  recommendation_id: string | null;
  approved_by: string | null;
  rejected_by: string | null;
  implemented_by: string | null;
  created_by: string;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  implemented_at: string | null;
  implementation_notes: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
};

export type DecisionImplementationRecord = {
  decision_id: string;
  implemented_by: string | null;
  implemented_at: string | null;
  implementation_notes: string | null;
};

export type DecisionEvidenceLink = {
  id: string;
  decision_id: string;
  evidence_id: string;
  evidence_type: string;
  relationship_type: DecisionEvidenceRelationship;
  created_at: string;
};

export type DecisionOutcomeLink = {
  id: string;
  decision_id: string;
  outcome_reference_id: string;
  outcome_type: string;
  created_at: string;
};

export type DecisionOutcomeType = "risk_reduction" | "schedule_improvement" | "cost_avoidance" | "stakeholder_alignment" | "resource_optimization" | "governance_compliance" | "other";
export type DecisionOutcomeStatus = "success" | "partial_success" | "failure" | "unknown";

export type DecisionOutcomeRecord = {
  id: string;
  workspace_id: string;
  project_id: string;
  decision_id: string;
  outcome_type: DecisionOutcomeType;
  outcome_status: DecisionOutcomeStatus;
  summary: string;
  recorded_by: string;
  recorded_at: string;
  metadata: Record<string, unknown>;
};

export type DecisionSummary = Pick<DecisionRecord, "id" | "workspace_id" | "project_id" | "decision_type" | "decision_status" | "title" | "summary" | "created_at" | "approved_at" | "closed_at"> & {
  evidenceCount: number;
  outcomeCount: number;
};

export type DecisionLineage = {
  decision: DecisionRecord;
  evidence: DecisionEvidenceLink[];
  recommendations: Array<Record<string, unknown>>;
  approvals: { approvedBy: string | null; approvedAt: string | null; rejectedBy: string | null; rejectedAt: string | null };
  implementation: DecisionImplementationRecord | null;
  outcomes: DecisionOutcomeRecord[];
  events: PlatformEventRow[];
  platformEvents: PlatformEventRow[];
};

export type DecisionEffectivenessSnapshot = {
  decisionId: string;
  decisionType: DecisionType;
  approvalDuration: number | null;
  timeToImplementation: number | null;
  outcomeStatus: DecisionOutcomeStatus | null;
  evidenceCount: number;
  recommendationPresent: boolean;
};

export type DecisionAuditPackage = {
  decision: DecisionRecord;
  evidence: DecisionEvidenceLink[];
  approvals: DecisionLineage["approvals"];
  implementation: DecisionImplementationRecord | null;
  outcomes: DecisionOutcomeRecord[];
  effectivenessSnapshot: DecisionEffectivenessSnapshot;
  lineage: DecisionLineage;
  events: PlatformEventRow[];
};
