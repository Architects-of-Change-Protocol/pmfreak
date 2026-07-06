/**
 * Sprint 9 — Intent Classifier types.
 *
 * These types describe a deterministic, rule-based classification of a single normalized
 * conversational turn. Nothing here executes an action, resolves project context, or decides a
 * final route — that is Context Resolver (Sprint 10) and Route Decision (future sprint) territory.
 * `candidateRoutes` is only a hint of which downstream engine(s) would plausibly handle this
 * intent once context has been resolved.
 */

/** Mirrors the normalized-turn shape produced by the Conversation Gateway (Sprint 8). */
export type NormalizedConversationInput = {
  workspaceId: string;
  userId: string;
  projectId?: string;
  threadId?: string;
  message: string;
  attachments?: unknown[];
};

export type ConversationIntentFamily =
  | "general_pm_advice"
  | "project_status"
  | "playbook_analysis"
  | "communication_draft"
  | "closure_billing"
  | "governance_audit"
  | "task_action"
  | "decision_support"
  | "risk_issue_dependency"
  | "unknown"
  | "needs_clarification";

export type ConversationIntentType =
  // closure_billing
  | "billing_blocker_check"
  | "billing_readiness_check"
  | "closure_readiness_check"
  | "reception_status_check"
  | "acceptance_status_check"
  // communication_draft
  | "email_draft_request"
  | "follow_up_draft_request"
  | "escalation_draft_request"
  | "meeting_minutes_request"
  | "closure_communication_request"
  | "reception_request_draft"
  // playbook_analysis
  | "playbook_recommendation_request"
  | "playbook_rule_explanation"
  | "playbook_gap_analysis"
  | "governed_next_action_request"
  // project_status
  | "project_status_summary"
  | "project_health_check"
  | "project_timeline_check"
  | "project_blockers_check"
  // task_action
  | "task_creation_request"
  | "task_update_request"
  | "action_execution_request"
  | "convert_recommendation_request"
  // governance_audit
  | "recommendation_explanation"
  | "audit_trail_request"
  | "evidence_request"
  | "why_recommended_request"
  // risk_issue_dependency
  | "risk_check"
  | "issue_check"
  | "dependency_check"
  | "blocker_check"
  // decision_support
  | "decision_needed_check"
  | "decision_options_request"
  | "decision_recommendation_request"
  // general_pm_advice
  | "general_guidance"
  | "project_management_advice"
  | "stakeholder_strategy"
  | "escalation_advice"
  // fallbacks — not tied to a specific family's real pattern list
  | "clarification_needed"
  | "unrecognized_intent";

export type IntentConfidence = "high" | "medium" | "low" | "unknown";

export type CandidateRoute =
  | "general_pm_advisor"
  | "project_brain"
  | "playbook_engine"
  | "communications_engine"
  | "closure_billing_engine"
  | "governance_engine"
  | "task_action_engine"
  | "clarification"
  | "unsupported";

export type IntentSignal = {
  family: ConversationIntentFamily;
  intentType: ConversationIntentType;
  label: string;
  weight: 5 | 3 | 1;
};

export type MissingClarificationType = "missing_project";

export type MissingClarification = {
  type: MissingClarificationType;
  message: string;
};

export type ConversationIntent = {
  intentFamily: ConversationIntentFamily;
  intentType: ConversationIntentType;
  confidence: IntentConfidence;
  /** Raw accumulated weight for the winning family — not normalized/percentage. */
  score: number;
  rationale: string;
  requiresProjectContext: boolean;
  requiresEvidence: boolean;
  mayRequireApproval: boolean;
  isActionRequest: boolean;
  isExternalCommunicationRequest: boolean;
  isReadOnly: boolean;
  candidateRoutes: CandidateRoute[];
  detectedSignals: IntentSignal[];
  missingClarifications: MissingClarification[];
  createdAt: string;
};

export type IntentClassificationResult = {
  intent: ConversationIntent;
  normalizedMessage: string;
  /** Diagnostic view of every family that matched at least one pattern, before tie-breaking. */
  familyScores: Partial<Record<ConversationIntentFamily, number>>;
};

export type ClassifyIntentOptions = {
  /** Injectable clock for deterministic tests. Defaults to `() => new Date().toISOString()`. */
  now?: () => string;
};
