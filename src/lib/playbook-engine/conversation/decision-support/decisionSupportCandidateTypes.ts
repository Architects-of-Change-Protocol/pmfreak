/**
 * Sprint 19R — Decision Support Candidate Handler: types.
 *
 * Pure type definitions for an isolated, read-only candidate handler that answers
 * decision-shaped PM questions ("qué opción debería escoger", "conviene escalar o esperar",
 * "deberíamos cerrar ya o pedir más evidencia") with a structured, deterministic analysis.
 *
 * This module is not imported by the router, composer, any production handler, or the gateway.
 * It has no production wiring — see `docs/conversational-brain-decision-support-candidate-handler.md`
 * for the full scope and non-goals. Nothing in this package tree calls fetch, a database, Supabase,
 * Gmail, or an LLM.
 */

// ─── Input ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportInputSource = "manual_test" | "candidate_handler" | "architecture_review" | "future_router";

export type DecisionSupportContext = {
  projectStatus?: string;
  knownRisks?: string[];
  knownIssues?: string[];
  knownDependencies?: string[];
  knownConstraints?: string[];
  knownEvidence?: string[];
  stakeholderPreferences?: string[];
  contractualConstraints?: string[];
  billingConstraints?: string[];
  deliveryConstraints?: string[];
  governanceConstraints?: string[];
  previousRecommendations?: string[];
  notes?: string[];
};

export type DecisionSupportInput = {
  input: string;
  projectId?: string;
  projectName?: string;
  conversationId?: string;
  availableContext?: DecisionSupportContext;
  source?: DecisionSupportInputSource;
  /** ISO timestamp, injected by the caller — this module never reads the system clock. */
  now?: string;
};

// ─── Decision types ──────────────────────────────────────────────────────────────────

export type DecisionSupportDecisionType =
  | "choose_between_options"
  | "escalate_or_wait"
  | "close_or_continue"
  | "bill_or_wait"
  | "accept_or_mitigate_risk"
  | "change_vendor_or_continue"
  | "approve_or_request_evidence"
  | "prioritize_next_step"
  | "identify_missing_decision"
  | "general_decision_support";

// ─── Options ─────────────────────────────────────────────────────────────────────────

export type DecisionSupportImpact = "low" | "medium" | "high" | "unknown";
export type DecisionSupportReversibility = "easy" | "moderate" | "hard" | "unknown";

export type DecisionSupportOption = {
  id: string;
  label: string;
  description: string;
  /** True when this option's label was extracted directly from the input text, false when it is a
   * generic placeholder option constructed because the input implied a decision without naming
   * concrete alternatives. */
  detectedFromInput: boolean;
  pros: string[];
  cons: string[];
  risks: string[];
  evidenceNeeded: string[];
  likelyImpact: DecisionSupportImpact;
  reversibility: DecisionSupportReversibility;
};

// ─── Tradeoffs / risks / evidence ────────────────────────────────────────────────────

export type DecisionSupportRiskLevel = "low" | "medium" | "high" | "unknown";

export type DecisionSupportTradeoff = {
  dimension: string;
  optionA?: string;
  optionB?: string;
  summary: string;
  riskLevel: DecisionSupportRiskLevel;
};

export type DecisionSupportRisk = {
  description: string;
  severity: DecisionSupportRiskLevel;
  mitigation?: string;
  relatedOptionId?: string;
};

export type DecisionSupportEvidenceNeedPriority = "low" | "medium" | "high";

export type DecisionSupportEvidenceNeed = {
  description: string;
  reason: string;
  priority: DecisionSupportEvidenceNeedPriority;
};

// ─── Recommendation ──────────────────────────────────────────────────────────────────

export type DecisionSupportConfidence = "low" | "medium" | "high";

export type DecisionSupportRecommendation = {
  recommendedOptionId?: string;
  recommendedPath: string;
  rationale: string[];
  confidence: DecisionSupportConfidence;
  confidenceReason: string;
  caveats: string[];
  suggestedNextStep: string;
  shouldAskClarifyingQuestion: boolean;
  clarificationQuestion?: string;
};

// ─── Safety / audit ──────────────────────────────────────────────────────────────────

export type DecisionSupportSafety = {
  shouldExecuteAction: false;
  shouldCreateTask: false;
  shouldSendEmail: false;
  shouldWriteToDb: false;
  requiresHumanConfirmation: true;
  productionRoutingEnabled: false;
};

export type DecisionSupportAuditMetadata = {
  handlerVersion: string;
  generatedAt?: string;
  matchedPatterns: string[];
  optionExtractionStrategy: string;
  recommendationStrategy: string;
  limitations: string[];
};

// ─── Result ──────────────────────────────────────────────────────────────────────────

export type DecisionSupportCandidateResult = {
  kind: "decision_support_candidate_result";
  input: string;
  normalizedInput: string;
  decisionStatement: string;
  detectedDecisionType: DecisionSupportDecisionType;
  options: DecisionSupportOption[];
  tradeoffs: DecisionSupportTradeoff[];
  risks: DecisionSupportRisk[];
  evidenceNeeded: DecisionSupportEvidenceNeed[];
  recommendation: DecisionSupportRecommendation;
  safety: DecisionSupportSafety;
  auditMetadata: DecisionSupportAuditMetadata;
  warnings: string[];
};
