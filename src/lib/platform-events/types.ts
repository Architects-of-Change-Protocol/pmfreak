// ─────────────────────────────────────────────────────────────────────────────
// Governance Event Layer — TypeScript types
//
// These types define the vocabulary for platform_events.
// Event types use string literals (not DB enums) for flexibility.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Actor ───────────────────────────────────────────────────────────────────

export type PlatformEventActorType = "user" | "ai_agent" | "system" | "integration";

// ─── Source ──────────────────────────────────────────────────────────────────

export type PlatformEventSource =
  | "user_action"
  | "ai_agent"
  | "system"
  | "integration"
  | "migration"
  | "import";

// ─── Visibility ──────────────────────────────────────────────────────────────

export type PlatformEventVisibility =
  | "personal"
  | "project"
  | "workspace"
  | "tenant"
  | "global_anonymous";

// ─── Sensitivity ─────────────────────────────────────────────────────────────

export type PlatformEventSensitivityLevel = "public" | "internal" | "confidential" | "restricted";

// ─── Event categories ────────────────────────────────────────────────────────

export type PlatformEventCategory =
  | "project"
  | "risk"
  | "dependency"
  | "scope"
  | "recommendation"
  | "decision"
  | "outcome"
  | "governance"
  | "document"
  | "stakeholder"
  | "financial"
  | "system";

// ─── Event types by category ─────────────────────────────────────────────────

// Project
export type ProjectEventType =
  | "PROJECT_CREATED"
  | "PROJECT_UPDATED"
  | "PROJECT_STATUS_CHANGED"
  | "PROJECT_PHASE_CHANGED"
  | "PROJECT_ARCHIVED";

// Risk
export type RiskEventType =
  | "RISK_CREATED"
  | "RISK_UPDATED"
  | "RISK_ESCALATED"
  | "RISK_MITIGATED"
  | "RISK_CLOSED"
  | "RISK_REOPENED";

// Dependency
export type DependencyEventType =
  | "DEPENDENCY_CREATED"
  | "DEPENDENCY_UPDATED"
  | "DEPENDENCY_BLOCKED"
  | "DEPENDENCY_RESOLVED"
  | "DEPENDENCY_ESCALATED";

// Scope
export type ScopeEventType =
  | "SCOPE_CHANGE_REQUESTED"
  | "SCOPE_CHANGE_APPROVED"
  | "SCOPE_CHANGE_REJECTED"
  | "SCOPE_CHANGED";

// AI Recommendation
export type RecommendationEventType =
  | "AI_RECOMMENDATION_CREATED"
  | "AI_RECOMMENDATION_ACCEPTED"
  | "AI_RECOMMENDATION_REJECTED"
  | "AI_RECOMMENDATION_MODIFIED"
  | "AI_RECOMMENDATION_IGNORED"
  | "AI_RECOMMENDATION_EXPIRED";

// Human Decision
export type DecisionEventType =
  | "DECISION_CREATED"
  | "DECISION_SUBMITTED"
  | "DECISION_APPROVED"
  | "DECISION_REJECTED"
  | "DECISION_IMPLEMENTED"
  | "DECISION_IMPLEMENTATION_RECORDED"
  | "DECISION_EXPIRED"
  | "HUMAN_DECISION_RECORDED"
  | "HUMAN_OVERRIDE_RECORDED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_REJECTED"
  | "DECISION_ESCALATED";

// Outcome
export type OutcomeEventType =
  | "OUTCOME_RECORDED"
  | "DECISION_OUTCOME_RECORDED"
  | "DECISION_OUTCOME_SUCCESS"
  | "DECISION_OUTCOME_PARTIAL_SUCCESS"
  | "DECISION_OUTCOME_FAILURE"
  | "PROJECT_COMPLETED"
  | "PROJECT_DELAY_RECORDED"
  | "BUDGET_VARIANCE_RECORDED"
  | "CUSTOMER_SATISFACTION_RECORDED";

// Governance
export type GovernanceEventType =
  | "GOVERNANCE_CHECK_CREATED"
  | "GOVERNANCE_EXCEPTION_RECORDED"
  | "GOVERNANCE_POLICY_APPLIED"
  | "CONSTITUTIONAL_REVIEW_TRIGGERED";

// Constitution Lifecycle
export type ConstitutionLifecycleEventType =
  | "CONSTITUTION_CREATED"
  | "CONSTITUTION_UPDATED"
  | "CONSTITUTION_PROPOSED"
  | "CONSTITUTION_APPROVED"
  | "CONSTITUTION_ACTIVATED"
  | "CONSTITUTION_SUSPENDED"
  | "CONSTITUTION_CLOSED"
  | "CONSTITUTION_ARCHIVED"
  | "CONSTITUTION_STATUS_CHANGED";

// Constitution Amendment Governance
export type ConstitutionAmendmentEventType =
  | "CONSTITUTION_AMENDMENT_CREATED"
  | "CONSTITUTION_AMENDMENT_UPDATED"
  | "CONSTITUTION_AMENDMENT_PROPOSED"
  | "CONSTITUTION_AMENDMENT_APPROVED"
  | "CONSTITUTION_AMENDMENT_REJECTED"
  | "CONSTITUTION_AMENDMENT_WITHDRAWN"
  | "CONSTITUTION_AMENDMENT_APPLIED"
  | "CONSTITUTION_SNAPSHOT_CREATED"
  | "CONSTITUTION_VERSION_INCREMENTED";

// Document
export type DocumentEventType =
  | "DOCUMENT_ADDED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_REVIEWED"
  | "DOCUMENT_APPROVED";

// Stakeholder
export type StakeholderEventType =
  | "STAKEHOLDER_ADDED"
  | "STAKEHOLDER_UPDATED"
  | "STAKEHOLDER_APPROVAL_DELAYED"
  | "STAKEHOLDER_ESCALATED";

// Financial
export type FinancialEventType =
  | "BUDGET_UPDATED"
  | "PAYMENT_BLOCKER_RECORDED"
  | "PURCHASE_ORDER_CREATED"
  | "INVOICE_BLOCKER_RECORDED";

// System
export type SystemEventType =
  | "WORKSPACE_CREATED"
  | "TENANT_SETTINGS_UPDATED"
  | "IMPORT_COMPLETED"
  | "INTEGRATION_SYNC_COMPLETED";

// Constitutional Decision Governance
export type ConstitutionalDecisionEventType =
  | "CONSTITUTIONAL_DECISION_CREATED"
  | "CONSTITUTIONAL_DECISION_UPDATED"
  | "CONSTITUTIONAL_DECISION_PROPOSED"
  | "CONSTITUTIONAL_DECISION_APPROVED"
  | "CONSTITUTIONAL_DECISION_REJECTED"
  | "CONSTITUTIONAL_DECISION_EXECUTED"
  | "CONSTITUTIONAL_DECISION_CANCELLED"
  | "CONSTITUTIONAL_DECISION_OPTION_ADDED"
  | "CONSTITUTIONAL_DECISION_OPTION_SELECTED"
  | "CONSTITUTIONAL_DECISION_EVIDENCE_ATTACHED"
  | "CONSTITUTIONAL_DECISION_LINK_CREATED"
  | "CONSTITUTIONAL_DECISION_AMENDMENT_GENERATED";

// Constitutional Ratification
export type ConstitutionalRatificationEventType =
  | "CONSTITUTIONAL_SIGNATURE_REQUESTED"
  | "CONSTITUTIONAL_SIGNATURE_SIGNED"
  | "CONSTITUTIONAL_SIGNATURE_REJECTED"
  | "CONSTITUTIONAL_SIGNATURE_WITHDRAWN"
  | "CONSTITUTIONAL_SIGNATURE_EXPIRED"
  | "CONSTITUTIONAL_ENTITY_RATIFIED"
  | "CONSTITUTIONAL_RATIFICATION_FAILED"
  | "CONSTITUTIONAL_LEGITIMACY_UPDATED";

// Authority Governance
export type AuthorityGovernanceEventType =
  | "AUTHORITY_REGISTERED"
  | "AUTHORITY_REVOKED"
  | "AUTHORITY_EXPIRED"
  | "AUTHORITY_DELEGATED"
  | "DELEGATION_REVOKED"
  | "DELEGATION_EXPIRED"
  | "GOVERNANCE_VIOLATION_DETECTED"
  | "GOVERNANCE_VIOLATION_RESOLVED"
  | "AUTHORITY_ESCALATION_CREATED"
  | "AUTHORITY_ESCALATION_RESOLVED"
  | "ACCOUNTABILITY_CHAIN_BUILT";

// Constitutional Vault — Sovereign Memory
export type ConstitutionalVaultEventType =
  | "CONSTITUTIONAL_ARTIFACT_REGISTERED"
  | "CONSTITUTIONAL_ARTIFACT_UPDATED"
  | "CONSTITUTIONAL_ARTIFACT_ARCHIVED"
  | "CONSTITUTIONAL_MEMORY_CREATED"
  | "CONSTITUTIONAL_MEMORY_UPDATED"
  | "CONSTITUTIONAL_MEMORY_LINKED"
  | "CONSTITUTIONAL_LINEAGE_GENERATED";

// Program
export type ProgramEventType =
  | "PROGRAM_CREATED"
  | "PROGRAM_UPDATED"
  | "PROGRAM_ARCHIVED"
  | "PROGRAM_STATUS_CHANGED";

// Program Roadmap Source
export type ProgramRoadmapSourceEventType =
  | "PROGRAM_ROADMAP_SOURCE_CREATED"
  | "PROGRAM_ROADMAP_SOURCE_UPDATED"
  | "PROGRAM_ROADMAP_SOURCE_ACTIVATED"
  | "PROGRAM_ROADMAP_SOURCE_ARCHIVED";

// Program Roadmap Parse Result
export type ProgramRoadmapParseResultEventType =
  | "PROGRAM_ROADMAP_PARSED"
  | "PROGRAM_ROADMAP_PARSE_FAILED"
  | "PROGRAM_ROADMAP_PARSE_RESULT_ARCHIVED";

// Governance Signal Engine — EPIC 3 Sprint 1
export type GovernanceSignalEventType =
  | "GOVERNANCE_SIGNAL_DETECTED"
  | "GOVERNANCE_SIGNAL_ACKNOWLEDGED"
  | "GOVERNANCE_SIGNAL_RESOLVED"
  | "GOVERNANCE_SIGNAL_DISMISSED"
  | "GOVERNANCE_SIGNAL_CONFIDENCE_CALCULATED"
  | "GOVERNANCE_SIGNAL_SEVERITY_CALCULATED"
  | "GOVERNANCE_SIGNAL_CORRELATED"
  | "GOVERNANCE_HEALTH_CALCULATED";

// Program Epic
export type ProgramEpicEventType =
  | "PROGRAM_EPIC_CREATED"
  | "PROGRAM_EPIC_UPDATED"
  | "PROGRAM_EPIC_ARCHIVED";

// Program Sprint
export type ProgramSprintEventType =
  | "PROGRAM_SPRINT_CREATED"
  | "PROGRAM_SPRINT_UPDATED"
  | "PROGRAM_SPRINT_ARCHIVED";

// Program Card
export type ProgramCardEventType =
  | "PROGRAM_CARD_CREATED"
  | "PROGRAM_CARD_UPDATED"
  | "PROGRAM_CARD_ARCHIVED";

// Program Materialization
export type ProgramMaterializationEventType =
  | "PROGRAM_MATERIALIZATION_STARTED"
  | "PROGRAM_MATERIALIZATION_COMPLETED"
  | "PROGRAM_MATERIALIZATION_FAILED"
  | "PROGRAM_EPIC_MATERIALIZED"
  | "PROGRAM_SPRINT_MATERIALIZED"
  | "PROGRAM_CARD_MATERIALIZED";

// Execution Projection Engine — EPIC 3 Sprint 4
export type ExecutionProjectionEventType =
  | "EXECUTION_PROJECTION_GENERATED"
  | "EXECUTION_PROJECTION_VALIDATED"
  | "EXECUTION_PROJECTION_APPROVED"
  | "EXECUTION_PROJECTION_REJECTED"
  | "EXECUTION_PROJECTION_ARCHIVED"
  | "EXECUTION_PROJECTION_EFFORT_CALCULATED"
  | "EXECUTION_PROJECTION_RISK_CALCULATED"
  | "EXECUTION_PROJECTION_CONFIDENCE_CALCULATED"
  | "EXECUTION_PROJECTION_READINESS_CALCULATED"
  | "EXECUTION_PROJECTION_LINEAGE_GENERATED";

// Project Operating System — EPIC 4 Sprint 1
export type ProjectOSEventType =
  | "PROJECT_OS_SNAPSHOT_GENERATED"
  | "PROJECT_OS_SNAPSHOT_VALIDATED"
  | "PROJECT_OS_SNAPSHOT_ARCHIVED"
  | "PROJECT_OS_HEALTH_CALCULATED"
  | "PROJECT_OS_ATTENTION_ITEM_CREATED"
  | "PROJECT_OS_CONTEXT_COMPOSED"
  | "PROJECT_OS_LINEAGE_GENERATED";

// Operational Command Center — EPIC 4 Sprint 2
export type OperationalCommandCenterEventType =
  | "OPERATIONAL_COMMAND_CENTER_GENERATED"
  | "OPERATIONAL_COMMAND_CENTER_VALIDATED"
  | "OPERATIONAL_COMMAND_CENTER_ARCHIVED"
  | "OPERATIONAL_FOCUS_ITEM_CREATED"
  | "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED"
  | "OPERATIONAL_FOCUS_ITEM_STARTED"
  | "OPERATIONAL_FOCUS_ITEM_RESOLVED"
  | "OPERATIONAL_FOCUS_ITEM_DISMISSED"
  | "OPERATIONAL_FOCUS_SCORE_CALCULATED"
  | "OPERATIONAL_PRIORITY_CALCULATED"
  | "OPERATIONAL_FOCUS_LINEAGE_GENERATED";

// Decision Outcome Engine — EPIC 4 Sprint 5
export type DecisionOutcomeEngineEventType =
  | "OPERATIONAL_DECISION_OUTCOME_CREATED"
  | "OPERATIONAL_OUTCOME_OBSERVATION_RECORDED"
  | "OPERATIONAL_DECISION_OUTCOME_EVALUATED"
  | "OPERATIONAL_DECISION_OUTCOME_COMPLETED"
  | "OPERATIONAL_DECISION_OUTCOME_ARCHIVED"
  | "OPERATIONAL_DECISION_EFFECTIVENESS_CALCULATED"
  | "OPERATIONAL_RECOMMENDATION_QUALITY_CALCULATED"
  | "OPERATIONAL_OUTCOME_LEARNING_GENERATED"
  | "OPERATIONAL_RECOMMENDATION_EVOLUTION_UPDATED"
  | "OPERATIONAL_DECISION_OUTCOME_LINEAGE_GENERATED";

// PM Registry
export type PMRegistryEventType =
  | "PROJECT_MANAGER_REGISTERED"
  | "PROJECT_MANAGER_UPDATED"
  | "PROJECT_MANAGER_ASSIGNED"
  | "PROJECT_MANAGER_UNASSIGNED"
  | "PROJECT_MANAGER_PROFILE_UPDATED";

// Union of all event types
export type PlatformEventType =
  | ProjectEventType
  | RiskEventType
  | DependencyEventType
  | ScopeEventType
  | RecommendationEventType
  | DecisionEventType
  | OutcomeEventType
  | GovernanceEventType
  | DocumentEventType
  | StakeholderEventType
  | FinancialEventType
  | SystemEventType
  | ConstitutionLifecycleEventType
  | ConstitutionAmendmentEventType
  | ConstitutionalDecisionEventType
  | ConstitutionalRatificationEventType
  | AuthorityGovernanceEventType
  | ConstitutionalVaultEventType
  | ProgramEventType
  | ProgramRoadmapSourceEventType
  | ProgramRoadmapParseResultEventType
  | ProgramEpicEventType
  | ProgramSprintEventType
  | ProgramCardEventType
  | ProgramMaterializationEventType
  | ExecutionProjectionEventType
  | ProjectOSEventType
  | OperationalCommandCenterEventType
  | DecisionOutcomeEngineEventType
  | PMRegistryEventType;

// ─── Row type (matches platform_events table) ─────────────────────────────────

export type PlatformEventRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  actor_id: string | null;
  actor_type: PlatformEventActorType;
  event_type: string;
  event_category: PlatformEventCategory;
  event_payload: Record<string, unknown>;
  source: PlatformEventSource;
  correlation_id: string | null;
  causation_id: string | null;
  visibility: PlatformEventVisibility;
  sensitivity_level: PlatformEventSensitivityLevel;
  learning_eligible: boolean;
  raw_reference_table: string | null;
  raw_reference_id: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

// ─── Input type for createPlatformEvent ──────────────────────────────────────

export type CreatePlatformEventInput = {
  workspaceId: string;
  projectId?: string | null;
  actorId?: string | null;
  actorType?: PlatformEventActorType;
  eventType: PlatformEventType | string;
  eventCategory: PlatformEventCategory;
  eventPayload?: Record<string, unknown>;
  source?: PlatformEventSource;
  correlationId?: string | null;
  causationId?: string | null;
  visibility?: PlatformEventVisibility;
  sensitivityLevel?: PlatformEventSensitivityLevel;
  learningEligible?: boolean;
  rawReferenceTable?: string | null;
  rawReferenceId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
};

// ─── Query filter type ───────────────────────────────────────────────────────

export type PlatformEventFilters = {
  workspaceId: string;
  projectId?: string;
  actorId?: string;
  eventType?: string;
  eventCategory?: PlatformEventCategory;
  correlationId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
};

// ─── Result type ─────────────────────────────────────────────────────────────

export type PlatformEventResult =
  | { ok: true; event: PlatformEventRow }
  | { ok: false; error: string; failureClass: string };

export type PlatformEventListResult =
  | { ok: true; events: PlatformEventRow[] }
  | { ok: false; error: string; failureClass: string };
