/**
 * Sprint 22R — Clarification Response Strategy: types.
 *
 * Pure type definitions for an isolated, read-only clarification response strategy that answers
 * ambiguous PM messages ("ayuda", "revisá esto", "qué hacemos", "dale seguimiento") with a
 * structured, deterministic clarifying question — instead of inventing context, giving overly
 * generic PM advice, or executing an action without authorization.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway. It
 * has no production wiring — see `docs/conversational-brain-clarification-response-strategy.md` for
 * the full scope and non-goals. Nothing in this package tree calls fetch, a database, Supabase,
 * Gmail, or an LLM.
 */

// ─── Input ─────────────────────────────────────────────────────────────────────────

export type ClarificationResponseInputSource = "manual_test" | "architecture_review" | "candidate_handler" | "future_router";

export type ClarificationAvailableContext = {
  knownProjectName?: string;
  knownProjectId?: string;
  recentMessages?: string[];
  attachedContextSummary?: string;
  detectedEntities?: string[];
  detectedProjectHints?: string[];
  previousIntent?: string;
  previousRoute?: string;
  previousClarificationQuestion?: string;
  notes?: string[];
};

export type ClarificationResponseInput = {
  input: string;
  projectId?: string;
  projectName?: string;
  conversationId?: string;
  availableContext?: ClarificationAvailableContext;
  source?: ClarificationResponseInputSource;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

// ─── Strategy types ──────────────────────────────────────────────────────────────────

export type ClarificationStrategyType =
  | "generic_ambiguous"
  | "review_without_context"
  | "follow_up_ambiguous"
  | "concern_without_domain"
  | "stalled_progress_ambiguous"
  | "communication_hint_ambiguous"
  | "task_hint_ambiguous"
  | "risk_hint_ambiguous"
  | "status_hint_ambiguous"
  | "decision_hint_ambiguous"
  | "context_missing_for_known_route";

// ─── Missing slots ───────────────────────────────────────────────────────────────────

export type ClarificationMissingSlot =
  | "project"
  | "intent"
  | "source_context"
  | "desired_output"
  | "urgency"
  | "owner"
  | "timeframe"
  | "action_authorization"
  | "evidence"
  | "recipient"
  | "decision_options";

// ─── Route options ───────────────────────────────────────────────────────────────────

export type ClarificationRouteOptionIntent =
  | "project_status_question"
  | "risk_analysis"
  | "communication_draft"
  | "task_or_action_request"
  | "closure_question"
  | "billing_question"
  | "recommendation_request"
  | "decision_support"
  | "governance_question"
  | "audit_question"
  | "general_pm_advice"
  | "unsupported";

export type ClarificationRouteOptionPriority = "low" | "medium" | "high";

export type ClarificationRouteOption = {
  intent: ClarificationRouteOptionIntent;
  label: string;
  description: string;
  exampleUserReply: string;
  priority: ClarificationRouteOptionPriority;
};

// ─── Questions ────────────────────────────────────────────────────────────────────────

export type ClarificationQuestion = {
  id: string;
  question: string;
  slot: ClarificationMissingSlot;
  priority: ClarificationRouteOptionPriority;
  reason: string;
};

// ─── Tone ─────────────────────────────────────────────────────────────────────────────

export type ClarificationResponseTone = "concise" | "guided" | "pm_friendly" | "formal";

// ─── Safety / audit ──────────────────────────────────────────────────────────────────

export type ClarificationResponseSafety = {
  shouldExecuteAction: false;
  shouldCreateTask: false;
  shouldSendEmail: false;
  shouldWriteToDb: false;
  requiresUserReply: true;
  productionRoutingEnabled: false;
  maxQuestionsRecommended: 3;
};

export type ClarificationResponseAuditMetadata = {
  strategyVersion: string;
  generatedAt?: string;
  matchedSignals: string[];
  missingSlots: ClarificationMissingSlot[];
  routeOptionStrategy: string;
  limitations: string[];
};

// ─── Result ──────────────────────────────────────────────────────────────────────────

export type ClarificationAmbiguityLevel = "low" | "medium" | "high";

export type ClarificationResponseCandidateResult = {
  kind: "clarification_response_candidate_result";
  input: string;
  normalizedInput: string;
  strategyType: ClarificationStrategyType;
  ambiguityLevel: ClarificationAmbiguityLevel;
  missingSlots: ClarificationMissingSlot[];
  suggestedRouteOptions: ClarificationRouteOption[];
  primaryQuestion: ClarificationQuestion;
  secondaryQuestions: ClarificationQuestion[];
  responseText: string;
  tone: ClarificationResponseTone;
  safety: ClarificationResponseSafety;
  auditMetadata: ClarificationResponseAuditMetadata;
  warnings: string[];
};
