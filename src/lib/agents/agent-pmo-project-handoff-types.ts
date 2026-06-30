// ─── PMO Controlled Project Intelligence Handoff — Types ─────────────────────
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT execute adapters, mutate external projects, or create external tickets.
// Does NOT send emails, Slack messages, or create calendar events.
// Does NOT delete project memory, overwrite project brain, or auto-assign PM.
// Updates ONLY dedicated project intelligence handoff records after explicit approval.

// ─── Union Types ──────────────────────────────────────────────────────────────

export type AgentPmoProjectHandoffRequestStatus =
  | "created"
  | "context_validation_pending"
  | "context_validation_failed"
  | "ready_for_pmo_review"
  | "pmo_review_required"
  | "pmo_approved"
  | "pmo_rejected"
  | "handoff_pack_pending"
  | "handoff_pack_created"
  | "outgoing_pm_notes_pending"
  | "incoming_pm_review_required"
  | "incoming_pm_accepted"
  | "incoming_pm_rejected"
  | "assignment_update_pending"
  | "handoff_completed"
  | "continuity_monitoring"
  | "blocked"
  | "archived";

export type AgentPmoProjectHandoffReason =
  | "workload_rebalance"
  | "pm_unavailable"
  | "vacation_coverage"
  | "role_change"
  | "performance_intervention"
  | "client_escalation"
  | "project_complexity"
  | "strategic_reassignment"
  | "delivery_risk"
  | "pm_departure"
  | "temporary_coverage"
  | "other";

export type AgentPmoProjectHandoffUrgency =
  | "low"
  | "normal"
  | "high"
  | "critical";

export type AgentPmoProjectContextValidationStatus =
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "waived";

export type AgentPmoProjectHandoffGateStatus =
  | "created"
  | "under_review"
  | "approved_for_handoff"
  | "rejected"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoProjectHandoffGateDecisionType =
  | "approve_for_handoff"
  | "reject"
  | "request_changes"
  | "block"
  | "archive";

export type AgentPmoProjectHandoffPackStatus =
  | "created"
  | "assembled"
  | "pmo_review_ready"
  | "accepted"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoProjectMemorySnapshotCategory =
  | "project_summary"
  | "delivery_history"
  | "key_decisions"
  | "risks"
  | "blockers"
  | "dependencies"
  | "milestones"
  | "stakeholders"
  | "client_commitments"
  | "commercial_notes"
  | "technical_notes"
  | "governance_notes"
  | "open_questions"
  | "next_actions"
  | "lessons_learned";

export type AgentPmoProjectMemorySnapshotStatus =
  | "created"
  | "assembled"
  | "review_ready"
  | "accepted"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoProjectHealthStatus =
  | "unknown"
  | "green"
  | "yellow"
  | "red"
  | "blocked"
  | "not_applicable";

export type AgentPmoProjectHandoffSnapshotItemType =
  | "risk"
  | "blocker"
  | "open_decision"
  | "dependency"
  | "commitment"
  | "milestone"
  | "action_item"
  | "stakeholder_issue"
  | "commercial_item"
  | "technical_item"
  | "governance_item";

export type AgentPmoProjectHandoffSnapshotItemStatus =
  | "open"
  | "in_progress"
  | "pending_review"
  | "resolved"
  | "accepted"
  | "blocked"
  | "closed"
  | "unknown";

export type AgentPmoProjectHandoffSnapshotItemSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export type AgentPmoStakeholderContextType =
  | "client_sponsor"
  | "client_project_owner"
  | "client_technical_owner"
  | "internal_pmo_owner"
  | "internal_delivery_owner"
  | "internal_engineering_owner"
  | "vendor_contact"
  | "commercial_owner"
  | "support_contact"
  | "other";

export type AgentPmoStakeholderContextStatus =
  | "active"
  | "inactive"
  | "unknown"
  | "not_applicable";

export type AgentPmoOutgoingPmNoteType =
  | "delivery_context"
  | "client_context"
  | "technical_context"
  | "commercial_context"
  | "risk_context"
  | "blocker_context"
  | "decision_context"
  | "team_context"
  | "personal_warning"
  | "recommended_next_step"
  | "other";

export type AgentPmoOutgoingPmNoteStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  | "changes_requested"
  | "accepted"
  | "archived";

export type AgentPmoIncomingPmAcceptanceStatus =
  | "created"
  | "under_review"
  | "accepted"
  | "rejected"
  | "changes_requested"
  | "blocked"
  | "archived";

export type AgentPmoIncomingPmAcceptanceDecision =
  | "accept_handoff"
  | "request_changes"
  | "reject_handoff"
  | "block_handoff"
  | "archive";

export type AgentPmoProjectAssignmentSource =
  | "controlled_handoff"
  | "initial_assignment_snapshot"
  | "manual_import_reference"
  | "system_reference"
  | "unknown";

export type AgentPmoHandoffContinuityCheckType =
  | "incoming_pm_acknowledged"
  | "critical_risks_reviewed"
  | "critical_blockers_reviewed"
  | "upcoming_milestones_reviewed"
  | "open_decisions_reviewed"
  | "stakeholder_context_reviewed"
  | "client_commitments_reviewed"
  | "first_status_update_completed"
  | "handoff_pack_reviewed"
  | "assignment_pointer_verified";

export type AgentPmoHandoffContinuityCheckStatus =
  | "pending"
  | "passed"
  | "failed"
  | "blocked"
  | "waived"
  | "not_applicable";

export type AgentPmoProjectHandoffExportFormat =
  | "markdown"
  | "json"
  | "csv";

export type AgentPmoProjectHandoffExportStatus =
  | "created"
  | "generated"
  | "failed"
  | "downloaded"
  | "archived";

export type AgentPmoProjectHandoffAuditEventType =
  | "handoff_request_created"
  | "handoff_context_validation_created"
  | "handoff_context_validation_completed"
  | "handoff_pmo_gate_created"
  | "handoff_pmo_gate_decision_recorded"
  | "handoff_pack_created"
  | "project_memory_snapshot_created"
  | "project_status_snapshot_created"
  | "handoff_snapshot_item_created"
  | "stakeholder_context_snapshot_created"
  | "outgoing_pm_note_recorded"
  | "incoming_pm_acceptance_recorded"
  | "controlled_assignment_pointer_updated"
  | "project_assignment_history_recorded"
  | "handoff_continuity_check_created"
  | "handoff_continuity_check_completed"
  | "handoff_export_created"
  | "handoff_request_archived";

// ─── Records ──────────────────────────────────────────────────────────────────

export type AgentPmoProjectHandoffRequestRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  currentPmId: string | null;
  incomingPmId: string;
  requestedById: string | null;
  handoffReason: AgentPmoProjectHandoffReason;
  handoffUrgency: AgentPmoProjectHandoffUrgency;
  requestReason: string;
  status: AgentPmoProjectHandoffRequestStatus;
  effectiveDate: string | null;
  requestVersion: number;
  safeRequestPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectContextValidationRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  checkKey: string;
  checkLabel: string;
  status: AgentPmoProjectContextValidationStatus;
  finding: string;
  limitation: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectHandoffGateRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  gateStatus: AgentPmoProjectHandoffGateStatus;
  reviewedById: string | null;
  safeGatePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectHandoffGateDecisionRecord = {
  id: string;
  workspaceId: string;
  handoffGateId: string;
  handoffRequestId: string;
  decision: AgentPmoProjectHandoffGateDecisionType;
  rationale: string;
  decidedById: string | null;
  decidedAt: string;
  createdAt: string;
};

export type AgentPmoProjectHandoffPackRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  currentPmId: string | null;
  incomingPmId: string;
  handoffReason: AgentPmoProjectHandoffReason;
  packStatus: AgentPmoProjectHandoffPackStatus;
  executiveSummary: string;
  currentProjectState: string;
  healthSummary: string;
  scheduleSummary: string;
  deliverySummary: string;
  financialSummary: string | null;
  riskSummary: string;
  blockerSummary: string;
  openDecisionSummary: string;
  dependencySummary: string;
  stakeholderSummary: string;
  commitmentSummary: string;
  milestoneSummary: string;
  recommendedFirstActions: string;
  limitations: string;
  safePackPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectMemorySnapshotRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  category: AgentPmoProjectMemorySnapshotCategory;
  snapshotStatus: AgentPmoProjectMemorySnapshotStatus;
  summary: string;
  limitation: string | null;
  itemCount: number;
  safeSnapshotPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectStatusSnapshotRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  projectHealth: AgentPmoProjectHealthStatus;
  scheduleHealth: AgentPmoProjectHealthStatus;
  scopeHealth: AgentPmoProjectHealthStatus;
  budgetHealth: AgentPmoProjectHealthStatus;
  deliveryPhase: string | null;
  completionEstimate: string | null;
  upcomingMilestoneCount: number;
  activeRiskCount: number;
  activeBlockerCount: number;
  openDecisionCount: number;
  pendingActionCount: number;
  safeStatusPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoProjectHandoffSnapshotItemRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  itemType: AgentPmoProjectHandoffSnapshotItemType;
  title: string;
  description: string;
  itemStatus: AgentPmoProjectHandoffSnapshotItemStatus;
  severity: AgentPmoProjectHandoffSnapshotItemSeverity;
  dueDate: string | null;
  sourceRef: string | null;
  safeItemPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoStakeholderContextSnapshotRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  stakeholderType: AgentPmoStakeholderContextType;
  roleLabel: string;
  contextSummary: string;
  stakeholderStatus: AgentPmoStakeholderContextStatus;
  safeContextPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoOutgoingPmNoteRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  noteType: AgentPmoOutgoingPmNoteType;
  noteText: string;
  noteStatus: AgentPmoOutgoingPmNoteStatus;
  authorId: string | null;
  safeNotePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoIncomingPmAcceptanceRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  handoffPackId: string | null;
  incomingPmId: string;
  decision: AgentPmoIncomingPmAcceptanceDecision;
  rationale: string;
  acceptanceStatus: AgentPmoIncomingPmAcceptanceStatus;
  safeAcceptancePayload: Record<string, unknown>;
  decidedAt: string;
  createdAt: string;
};

export type AgentPmoControlledProjectAssignmentPointerRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  activePmId: string;
  previousPmId: string | null;
  handoffRequestId: string | null;
  handoffCompletedById: string | null;
  handoffCompletedAt: string | null;
  assignmentVersion: number;
  handoffReason: AgentPmoProjectHandoffReason | null;
  safeAssignmentPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectAssignmentHistoryRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  handoffRequestId: string | null;
  previousPmId: string | null;
  newPmId: string;
  assignmentReason: string;
  assignmentSource: AgentPmoProjectAssignmentSource;
  effectiveDate: string | null;
  completedById: string | null;
  completedAt: string;
  safeHistoryPayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoHandoffContinuityCheckRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  checkType: AgentPmoHandoffContinuityCheckType;
  checkStatus: AgentPmoHandoffContinuityCheckStatus;
  rationale: string | null;
  completedAt: string | null;
  safeCheckPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoProjectHandoffExportRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string;
  exportFormat: AgentPmoProjectHandoffExportFormat;
  exportStatus: AgentPmoProjectHandoffExportStatus;
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdById: string | null;
  createdAt: string;
};

export type AgentPmoProjectHandoffAuditEventRecord = {
  id: string;
  workspaceId: string;
  handoffRequestId: string | null;
  eventType: AgentPmoProjectHandoffAuditEventType;
  message: string | null;
  safeEventPayload: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

// ─── Inputs ───────────────────────────────────────────────────────────────────

export type CreateAgentPmoProjectHandoffRequestInput = {
  workspaceId: string;
  projectId: string;
  currentPmId?: string | null;
  incomingPmId: string;
  requestedById?: string | null;
  handoffReason: AgentPmoProjectHandoffReason;
  handoffUrgency: AgentPmoProjectHandoffUrgency;
  requestReason: string;
  effectiveDate?: string | null;
};

export type CreateAgentPmoProjectHandoffGateInput = {
  workspaceId: string;
  handoffRequestId: string;
  reviewedById?: string | null;
};

export type RecordAgentPmoProjectHandoffGateDecisionInput = {
  workspaceId: string;
  handoffGateId: string;
  handoffRequestId: string;
  decision: AgentPmoProjectHandoffGateDecisionType;
  rationale: string;
  decidedById?: string | null;
};

export type CreateAgentPmoProjectHandoffPackInput = {
  workspaceId: string;
  handoffRequestId: string;
};

export type RecordAgentPmoOutgoingPmNoteInput = {
  workspaceId: string;
  handoffRequestId: string;
  noteType: AgentPmoOutgoingPmNoteType;
  noteText: string;
  status?: AgentPmoOutgoingPmNoteStatus;
  authorId?: string | null;
};

export type RecordAgentPmoIncomingPmAcceptanceInput = {
  workspaceId: string;
  handoffRequestId: string;
  handoffPackId?: string | null;
  incomingPmId: string;
  decision: AgentPmoIncomingPmAcceptanceDecision;
  rationale: string;
};

export type CompleteAgentPmoProjectHandoffInput = {
  workspaceId: string;
  handoffRequestId: string;
  completionRationale: string;
  completedById?: string | null;
};

export type GenerateAgentPmoProjectHandoffExportInput = {
  workspaceId: string;
  handoffRequestId: string;
  exportFormat: AgentPmoProjectHandoffExportFormat;
  createdById?: string | null;
};
