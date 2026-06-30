// ─── Controlled Governance Policy Simulation Report & PMO Approval Pack — Types
// Does NOT call LLMs, external APIs, or send communications.
// Does NOT perform real external side effects.
// Does NOT store raw payloads, free text rationale, or blocked identifiers.
// Does NOT mutate policies, routing, or scoring values.
// Does NOT apply policy changes — creates report/pack/checklist/sign-off records only.
// All operations are deterministic.

// ─── Status & Enum Types ──────────────────────────────────────────────────────

export type AgentPmoSimulationReportStatus =
  | "created" | "generating" | "generated" | "review_ready" | "signed_off" | "archived" | "failed";

export type AgentPmoSimulationReportSectionType =
  | "executive_summary"
  | "change_request_context"
  | "simulation_scope"
  | "historical_record_sample"
  | "simulation_results"
  | "impact_analysis"
  | "policy_draft_summary"
  | "approval_status"
  | "rollback_readiness"
  | "implementation_readiness"
  | "risk_statement"
  | "limitations"
  | "non_goals";

export type AgentPmoPolicyDiffChangeType =
  | "added" | "removed" | "changed" | "unchanged" | "unknown";

export type AgentPmoChecklistStatus =
  | "not_started" | "pending" | "passed" | "failed" | "blocked" | "not_applicable";

export type AgentPmoApprovalPackStatus =
  | "created" | "assembling" | "assembled" | "review_ready" | "signed_off"
  | "changes_requested" | "archived" | "failed";

export type AgentPmoSignOffStatus =
  | "created" | "under_review" | "approved_for_implementation_planning"
  | "rejected" | "changes_requested" | "archived";

export type AgentPmoSignOffDecisionType =
  | "approve_for_implementation_planning" | "reject" | "request_changes" | "archive";

export type AgentPmoApprovalPackArtifactType =
  | "simulation_report"
  | "impact_summary"
  | "policy_draft_diff"
  | "approval_checklist"
  | "rollback_checklist"
  | "signoff_packet"
  | "implementation_ticket_draft"
  | "export_bundle";

export type AgentPmoImplementationTicketDraftStatus =
  | "created" | "review_ready" | "blocked_until_signoff" | "archived";

export type AgentPmoImplementationTicketDraftType =
  | "implementation_planning" | "future_sprint_candidate" | "policy_change_preparation";

export type AgentPmoApprovalPackExportFormat =
  | "markdown" | "json" | "csv";

export type AgentPmoApprovalPackExportStatus =
  | "created" | "generating" | "generated" | "failed" | "archived";

export type AgentPmoApprovalPackEventType =
  | "approval_pack_created"
  | "approval_pack_assembling"
  | "approval_pack_assembled"
  | "simulation_report_created"
  | "simulation_report_section_created"
  | "impact_summary_created"
  | "policy_draft_diff_created"
  | "approval_checklist_created"
  | "approval_checklist_item_recorded"
  | "rollback_checklist_created"
  | "rollback_checklist_item_recorded"
  | "signoff_packet_created"
  | "signoff_decision_recorded"
  | "implementation_ticket_draft_created"
  | "approval_pack_export_created"
  | "approval_pack_archived";

// ─── Record Types ─────────────────────────────────────────────────────────────

export type AgentPmoSimulationReportRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  backlogItemId: string | null;
  simulationId: string | null;
  impactPreviewId: string | null;
  policyDraftId: string | null;
  approvalWorkflowId: string | null;
  rollbackPlanId: string | null;
  implementationReadinessId: string | null;
  status: AgentPmoSimulationReportStatus;
  reportVersion: number;
  title: string;
  executiveSummary: string;
  safeReportPayload: Record<string, unknown>;
  sectionCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoSimulationReportSectionRecord = {
  id: string;
  workspaceId: string;
  reportId: string;
  sectionType: AgentPmoSimulationReportSectionType;
  sectionTitle: string;
  sectionOrder: number;
  safeMarkdown: string;
  safePayload: Record<string, unknown>;
  sourceRecordIds: string[];
  createdAt: string;
};

export type AgentPmoPolicyImpactSummaryRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  simulationId: string | null;
  impactPreviewId: string | null;
  impactLevel: string;
  affectedDomains: string[];
  affectedActionTypes: string[];
  affectedAdapters: string[];
  estimatedReviewLoadChange: number;
  estimatedEvidenceBurdenChange: number;
  riskPostureEstimate: string;
  implementationComplexity: string;
  confidenceScore: number;
  summary: string;
  safePayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoPolicyDraftDiffRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  policyDraftId: string | null;
  unknownBaseline: boolean;
  baselineLabel: string;
  draftLabel: string;
  addedRules: string[];
  removedRules: string[];
  changedRules: string[];
  unchangedRules: string[];
  totalRuleCount: number;
  safePayload: Record<string, unknown>;
  createdAt: string;
};

export type AgentPmoApprovalChecklistRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  approvalPackId: string | null;
  overallStatus: AgentPmoChecklistStatus;
  itemCount: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  safePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoApprovalChecklistItemRecord = {
  id: string;
  workspaceId: string;
  checklistId: string;
  itemKey: string;
  itemLabel: string;
  itemOrder: number;
  status: AgentPmoChecklistStatus;
  notes: string;
  createdAt: string;
};

export type AgentPmoRollbackReadinessChecklistRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  rollbackPlanId: string | null;
  approvalPackId: string | null;
  overallStatus: AgentPmoChecklistStatus;
  itemCount: number;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  safePayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoRollbackReadinessChecklistItemRecord = {
  id: string;
  workspaceId: string;
  checklistId: string;
  itemKey: string;
  itemLabel: string;
  itemOrder: number;
  status: AgentPmoChecklistStatus;
  notes: string;
  createdAt: string;
};

export type AgentPmoSignOffPacketRecord = {
  id: string;
  workspaceId: string;
  approvalPackId: string | null;
  changeRequestId: string;
  simulationReportId: string | null;
  impactSummaryId: string | null;
  draftDiffId: string | null;
  approvalChecklistId: string | null;
  rollbackChecklistId: string | null;
  status: AgentPmoSignOffStatus;
  packetVersion: number;
  signOffSummary: string;
  safePayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoSignOffDecisionRecord = {
  id: string;
  workspaceId: string;
  signOffPacketId: string;
  approvalPackId: string | null;
  decisionType: AgentPmoSignOffDecisionType;
  rationale: string;
  decidedBy: string | null;
  createdAt: string;
};

export type AgentPmoApprovalPackRecord = {
  id: string;
  workspaceId: string;
  changeRequestId: string;
  backlogItemId: string | null;
  simulationReportId: string | null;
  impactSummaryId: string | null;
  draftDiffId: string | null;
  approvalChecklistId: string | null;
  rollbackChecklistId: string | null;
  signOffPacketId: string | null;
  implementationTicketDraftId: string | null;
  packStatus: AgentPmoApprovalPackStatus;
  packVersion: number;
  title: string;
  safePackPayload: Record<string, unknown>;
  artifactCount: number;
  exportCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoApprovalPackArtifactRecord = {
  id: string;
  workspaceId: string;
  approvalPackId: string;
  artifactType: AgentPmoApprovalPackArtifactType;
  artifactRefId: string | null;
  artifactLabel: string;
  createdAt: string;
};

export type AgentPmoImplementationTicketDraftRecord = {
  id: string;
  workspaceId: string;
  approvalPackId: string | null;
  changeRequestId: string;
  ticketTitle: string;
  ticketBody: string;
  ticketType: AgentPmoImplementationTicketDraftType;
  targetFutureSprint: string;
  acceptanceCriteria: string[];
  blockedUntilSignOff: boolean;
  status: AgentPmoImplementationTicketDraftStatus;
  safeTicketPayload: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPmoApprovalPackExportRecord = {
  id: string;
  workspaceId: string;
  approvalPackId: string;
  exportFormat: AgentPmoApprovalPackExportFormat;
  exportStatus: AgentPmoApprovalPackExportStatus;
  safeExportContent: string;
  exportSizeBytes: number;
  safetyValidationPassed: boolean;
  createdBy: string | null;
  createdAt: string;
};

export type AgentPmoApprovalPackEventRecord = {
  id: string;
  workspaceId: string | null;
  approvalPackId: string | null;
  changeRequestId: string | null;
  simulationReportId: string | null;
  signOffPacketId: string | null;
  eventType: AgentPmoApprovalPackEventType;
  message: string | null;
  safeEventPayload: Record<string, unknown>;
  actorId: string | null;
  createdAt: string;
};

// ─── Input Types ──────────────────────────────────────────────────────────────

export type CreateAgentPmoSimulationReportInput = {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
};

export type CreateAgentPmoApprovalPackInput = {
  workspaceId: string;
  changeRequestId: string;
  actorId?: string | null;
};

export type RecordAgentPmoSignOffDecisionInput = {
  workspaceId: string;
  signOffPacketId: string;
  approvalPackId?: string | null;
  decisionType: AgentPmoSignOffDecisionType;
  rationale: string;
  decidedBy?: string | null;
};

export type GenerateAgentPmoApprovalPackExportInput = {
  workspaceId: string;
  approvalPackId: string;
  exportFormat: AgentPmoApprovalPackExportFormat;
  actorId?: string | null;
};
