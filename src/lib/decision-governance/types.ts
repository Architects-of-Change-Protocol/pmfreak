import type { PlatformEventRow } from "@/lib/platform-events";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: "validation_failed" | "not_found" | "persistence_failed" | "event_emission_failed" };

export type DecisionStatus = "draft" | "pending_review" | "approved" | "rejected" | "implemented" | "expired";
export type DecisionType = "risk_response" | "scope_change" | "schedule_change" | "budget_change" | "resource_change" | "stakeholder_action" | "governance_exception" | "vendor_action" | "dependency_resolution" | "other";
export type DecisionEvidenceRelationship = "supports" | "contradicts" | "required_for" | "reviewed_during" | "triggered_by";
export type DecisionLifecycleEvent = "DECISION_CREATED" | "DECISION_SUBMITTED" | "DECISION_APPROVED" | "DECISION_REJECTED" | "DECISION_IMPLEMENTED" | "DECISION_EXPIRED";

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
  created_by: string;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown>;
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

export type DecisionSummary = Pick<DecisionRecord, "id" | "workspace_id" | "project_id" | "decision_type" | "decision_status" | "title" | "summary" | "created_at" | "approved_at" | "closed_at"> & {
  evidenceCount: number;
  outcomeCount: number;
};

export type DecisionLineage = {
  decision: DecisionRecord;
  evidence: DecisionEvidenceLink[];
  recommendations: Array<Record<string, unknown>>;
  approvals: { approvedBy: string | null; approvedAt: string | null; rejectedBy: string | null; rejectedAt: string | null };
  outcomes: DecisionOutcomeLink[];
  platformEvents: PlatformEventRow[];
};

export type DecisionAuditPackage = {
  decision: DecisionRecord;
  evidence: DecisionEvidenceLink[];
  approvals: DecisionLineage["approvals"];
  outcomes: DecisionOutcomeLink[];
  lineage: DecisionLineage;
  events: PlatformEventRow[];
};
