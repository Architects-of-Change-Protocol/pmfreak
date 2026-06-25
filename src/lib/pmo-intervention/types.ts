// ─── PMO Intervention / Action Loop — Types ──────────────────────────────────
//
// Human-governed action loop derived from PMO governance violations.
// Actions are proposed, reviewed, and approved by humans — never executed
// automatically. No PM assignments, capacity data, or performance records
// are mutated by this module.
// ─────────────────────────────────────────────────────────────────────────────

// ── Action types ──────────────────────────────────────────────────────────────

export type PMOInterventionActionType =
  | "complete_pm_profile"
  | "generate_capacity_snapshot"
  | "review_capacity_overload"
  | "generate_performance_snapshot"
  | "improve_evidence_coverage"
  | "escalate_critical_pm_risk"
  | "review_pm_performance_risk"
  | "review_assignment_hygiene"
  | "review_evidence_quality"
  | "review_intervention_readiness"
  | "manual_review";

// ── Priority ──────────────────────────────────────────────────────────────────

export type PMOInterventionPriority = "low" | "medium" | "high" | "critical";

// ── Status ────────────────────────────────────────────────────────────────────

export type PMOInterventionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "in_progress"
  | "completed"
  | "dismissed"
  | "cancelled";

// ── Approval status ───────────────────────────────────────────────────────────

export type PMOInterventionApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

// ── Source type ───────────────────────────────────────────────────────────────

export type PMOInterventionSourceType =
  | "pmo_governance_compliance"
  | "pmo_command_center"
  | "pm_operating_dossier"
  | "pm_capacity"
  | "pm_performance"
  | "evidence_confidence"
  | "manual";

// ── Target type ───────────────────────────────────────────────────────────────

export type PMOInterventionTargetType =
  | "pm"
  | "project"
  | "workspace"
  | "assignment"
  | "evidence";

// ── Action interface ──────────────────────────────────────────────────────────

export interface PMOInterventionAction {
  id: string;
  workspaceId: string;

  // Source
  sourceType: PMOInterventionSourceType;
  sourceId: string | null;
  sourceSnapshotId: string | null;
  sourceViolationId: string | null;
  sourceRecommendationId: string | null;

  // Action
  actionType: PMOInterventionActionType;
  actionTitle: string;
  actionDescription: string;
  priority: PMOInterventionPriority;
  status: PMOInterventionStatus;

  // Target
  targetType: PMOInterventionTargetType | null;
  targetId: string | null;
  targetName: string | null;

  // Context
  pmId: string | null;
  projectId: string | null;

  // Evidence / recommendation snapshot
  evidence: Record<string, unknown> | null;
  recommendation: string | null;

  // Approval
  requiresApproval: boolean;
  approvalStatus: PMOInterventionApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;

  // Completion
  completedBy: string | null;
  completedAt: string | null;
  completionNotes: string | null;

  // Dismissal
  dismissedBy: string | null;
  dismissedAt: string | null;
  dismissalReason: string | null;

  // Decision
  decisionReason: string | null;

  // Audit
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Generation result ─────────────────────────────────────────────────────────

export interface PMOInterventionGenerateResult {
  created_actions: PMOInterventionAction[];
  existing_open_actions: number;
  skipped_duplicates: number;
  source_snapshot_id: string | null;
  generated_at: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface GeneratePMOInterventionActionsInput {
  workspaceId: string;
  actorId?: string | null;
  generatedAt?: string;
  sourceSnapshotId?: string | null;
}

export interface ListPMOInterventionActionsInput {
  workspaceId: string;
  status?: PMOInterventionStatus;
  priority?: PMOInterventionPriority;
  actionType?: PMOInterventionActionType;
  targetType?: PMOInterventionTargetType;
  limit?: number;
}

export interface GetPMOInterventionActionInput {
  workspaceId: string;
  actionId: string;
}

export interface UpdatePMOInterventionActionStatusInput {
  workspaceId: string;
  actionId: string;
  actorId: string;
  status: PMOInterventionStatus;
  decisionReason?: string | null;
  completionNotes?: string | null;
  updatedAt?: string;
}

// ── Result type ───────────────────────────────────────────────────────────────

export type PMOInterventionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ── Event types ───────────────────────────────────────────────────────────────

export type PMOInterventionEventType =
  | "PMO_INTERVENTION_ACTION_GENERATED"
  | "PMO_INTERVENTION_ACTION_STATUS_CHANGED";
