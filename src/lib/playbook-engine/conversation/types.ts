/**
 * Conversational Brain Gateway (Sprint 8) — a natural-language front door in front of the
 * structured Playbook Engine (Sprints 1-7). Users should never have to speak in internal
 * playbook language ("evaluate rules", "generate closure assessment"); they ask normal
 * questions and this module classifies intent, resolves whatever project context is actually
 * available, routes to the right internal handler, and composes a PMFreak-style answer.
 *
 * Deliberately out of scope for this sprint: persistence, external LLM calls, vector DB/RAG,
 * and autonomous agents. Classification is rule-based and deterministic; handlers call the
 * existing governed engines (Sprints 1-7) when project evidence is available and otherwise
 * fall back to deterministic MVP guidance — never inventing evidence either way.
 */

import type { ProjectContextFacts } from "../types";
import type { PlaybookGovernanceSnapshot } from "../governance-snapshot-types";

export type ConversationIntent =
  | "general_pm_advice"
  | "project_status_question"
  | "recommendation_request"
  | "risk_analysis"
  | "communication_draft"
  | "closure_question"
  | "billing_question"
  | "governance_question"
  | "audit_question"
  | "task_or_action_request"
  | "clarification"
  | "unsupported"
  | "unknown";

export type BrainRoute =
  | "general_pm_advisor"
  | "project_status_handler"
  | "recommendation_handler"
  | "risk_handler"
  | "communications_handler"
  | "closure_billing_handler"
  | "governance_handler"
  | "audit_handler"
  | "task_action_handler"
  | "unsupported_handler";

export type ResponseMode =
  | "general_guidance"
  | "project_specific_analysis"
  | "recommendation"
  | "draft"
  | "clarification_needed"
  | "unsupported";

export type MissingContextItem =
  | "project"
  | "stakeholder"
  | "last_communication"
  | "blocked_milestone"
  | "due_date"
  | "decision_owner"
  | "acceptance_status"
  | "billing_status"
  | "risk_evidence"
  | "requested_output";

export type ConversationTurnRole = "user" | "assistant";

export type ConversationTurn = {
  role: ConversationTurnRole;
  message: string;
  intent?: ConversationIntent;
  createdAt?: string;
};

export type ConversationMetadata = {
  locale?: string;
  channel?: string;
  stakeholderName?: string;
  requestedOutput?: string;
  dueDate?: string;
  decisionOwner?: string;
  [key: string]: unknown;
};

export type ConversationalGatewayInput = {
  message: string;
  userId?: string;
  workspaceId?: string;
  activeProjectId?: string;
  activeProjectName?: string;
  /** Untyped on purpose — the gateway never assumes a shape. `contextResolver` narrows it to a
   * `ProjectContextFacts` only when it genuinely looks like one; otherwise it is treated as
   * "no structured project evidence available" rather than guessed at. */
  projectState?: unknown;
  conversationHistory?: ConversationTurn[];
  metadata?: ConversationMetadata;
};

export type IntentSignal = {
  intent: ConversationIntent;
  matchedPattern: string;
  weight: number;
};

export type ConversationLanguage = "es" | "en" | "unknown";

export type IntentClassification = {
  intent: ConversationIntent;
  confidence: number;
  signals: IntentSignal[];
  language: ConversationLanguage;
};

export type ResolvedProjectContext = {
  available: boolean;
  projectId: string | null;
  projectName: string | null;
  /** Populated only when `projectState` genuinely narrows to a `ProjectContextFacts` — never
   * fabricated from a partial/loosely-shaped object. */
  facts: ProjectContextFacts | null;
  /** The full Sprint 7 orchestrator output, computed once `facts` is available. `null` when
   * there isn't enough evidence to run the chain (mirrors `facts`). */
  governanceSnapshot: PlaybookGovernanceSnapshot | null;
};

export type ContextResolution = {
  intent: ConversationIntent;
  project: ResolvedProjectContext;
  missingContext: MissingContextItem[];
  /** 0-100 — how confident the resolver is that it has what this intent needs. */
  confidence: number;
  reasoning: string[];
};

export type BrainRoutingDecision = {
  intent: ConversationIntent;
  route: BrainRoute;
  reason: string;
};

export type HandlerResult = {
  mode: ResponseMode;
  headline: string;
  /** Paragraphs/bullets, composed into the final response text in order. */
  body: string[];
  recommendedNextSteps: string[];
  missingContext: MissingContextItem[];
  requiresApproval: boolean;
  auditRelevant: boolean;
  /** 0-100 — the handler's own confidence in this specific answer. */
  confidence: number;
  /** Whether this answer is backed by real evaluated project evidence (governed engines) as
   * opposed to deterministic MVP guidance with no project context. */
  sourced: boolean;
};

export type ConversationalGatewayDiagnostics = {
  intentSignals: IntentSignal[];
  routingReason: string;
  contextConfidence: number;
};

export type ConversationalGatewayResult = {
  intent: ConversationIntent;
  route: BrainRoute;
  mode: ResponseMode;
  response: string;
  summary: string;
  recommendedNextSteps: string[];
  missingContext: MissingContextItem[];
  confidence: number;
  requiresApproval: boolean;
  auditRelevant: boolean;
  diagnostics: ConversationalGatewayDiagnostics;
};
