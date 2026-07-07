/**
 * Sprint 22R — Clarification Response Strategy.
 *
 * A pure, read-only, isolated candidate strategy for ambiguous PM messages ("ayuda", "revisá esto",
 * "qué hacemos", "dale seguimiento"). It is NOT wired to the router, composer, any production
 * handler, or `POST /api/command-center/chat` — see
 * `docs/conversational-brain-clarification-response-strategy.md` for the full scope, safety
 * guarantees, and why this stays disconnected from production for now.
 *
 * `handleClarificationResponseCandidate()` never executes an action, never creates a task, never
 * sends a communication, never writes to a database, never calls Supabase/Gmail, never calls an LLM,
 * and never calls `fetch`. Every field in the returned `safety` object documents this explicitly.
 */

import {
  buildClarificationQuestions,
  detectClarificationStrategyTypeWithDetail,
  estimateAmbiguityLevel,
  inferMissingSlots,
  inferSuggestedRouteOptions,
  normalizeClarificationInput,
} from "./clarificationResponseAnalyzer";
import type {
  ClarificationAvailableContext,
  ClarificationResponseAuditMetadata,
  ClarificationResponseCandidateResult,
  ClarificationResponseInput,
  ClarificationResponseSafety,
  ClarificationResponseTone,
} from "./clarificationResponseTypes";

export const CLARIFICATION_RESPONSE_STRATEGY_VERSION = "22R.1.0";

const SAFETY: ClarificationResponseSafety = {
  shouldExecuteAction: false,
  shouldCreateTask: false,
  shouldSendEmail: false,
  shouldWriteToDb: false,
  requiresUserReply: true,
  productionRoutingEnabled: false,
  maxQuestionsRecommended: 3,
};

function buildAuditMetadata(
  matchedSignals: string[],
  missingSlots: ClarificationResponseCandidateResult["missingSlots"],
  strategyType: ClarificationResponseCandidateResult["strategyType"],
  now?: string,
): ClarificationResponseAuditMetadata {
  return {
    strategyVersion: CLARIFICATION_RESPONSE_STRATEGY_VERSION,
    generatedAt: now,
    matchedSignals,
    missingSlots,
    routeOptionStrategy: `deterministic-per-strategy-type:${strategyType}`,
    limitations: [
      "Keyword-based detection, not full NLP — see explainClarificationResponseAnalysis() for the full rule set.",
      "Does not implement a persistent clarification loop — each call is a single, stateless turn.",
      "Not connected to the production router, composer, or endpoint — candidate only.",
    ],
  };
}

/**
 * Runs the full clarification response pipeline for a single ambiguous message: validates the
 * input, normalizes it, detects a clarification strategy type, infers missing slots and suggested
 * route options, builds a primary + up to three secondary questions, estimates an ambiguity level,
 * and renders the final response text. Pure and deterministic — never calls fetch, a database,
 * Supabase, Gmail, or an LLM, and never executes an action, creates a task, or sends a communication.
 */
export function handleClarificationResponseCandidate(
  input: ClarificationResponseInput,
): ClarificationResponseCandidateResult {
  if (!input || typeof input.input !== "string" || input.input.trim().length === 0) {
    throw new Error("handleClarificationResponseCandidate: input.input must be a non-empty string.");
  }

  const warnings: string[] = [];
  const normalizedInput = normalizeClarificationInput(input.input);

  const effectiveContext: ClarificationAvailableContext = {
    ...input.availableContext,
    knownProjectId: input.availableContext?.knownProjectId ?? input.projectId,
    knownProjectName: input.availableContext?.knownProjectName ?? input.projectName,
  };

  const { strategyType, matchedPatterns } = detectClarificationStrategyTypeWithDetail(input.input);
  const missingSlots = inferMissingSlots(input.input, strategyType, effectiveContext);
  const suggestedRouteOptions = inferSuggestedRouteOptions(input.input, strategyType, missingSlots, effectiveContext);
  const { primaryQuestion, secondaryQuestions } = buildClarificationQuestions(
    input.input,
    strategyType,
    missingSlots,
    suggestedRouteOptions,
    effectiveContext,
  );
  const ambiguityLevel = estimateAmbiguityLevel(input.input, missingSlots, suggestedRouteOptions, effectiveContext);

  if (suggestedRouteOptions.length === 0) {
    warnings.push("No suggested route options were produced for this input.");
  }
  if (secondaryQuestions.length > 3) {
    warnings.push("More than three secondary questions were generated — trimmed to the first three.");
  }

  const tone: ClarificationResponseTone = "pm_friendly";
  const auditMetadata = buildAuditMetadata(matchedPatterns, missingSlots, strategyType, input.now);

  const draftResult: ClarificationResponseCandidateResult = {
    kind: "clarification_response_candidate_result",
    input: input.input,
    normalizedInput,
    strategyType,
    ambiguityLevel,
    missingSlots,
    suggestedRouteOptions,
    primaryQuestion,
    secondaryQuestions: secondaryQuestions.slice(0, 3),
    responseText: "",
    tone,
    safety: SAFETY,
    auditMetadata,
    warnings,
  };

  return { ...draftResult, responseText: formatClarificationResponseCandidate(draftResult) };
}

export type FormatClarificationResponseCandidateOptions = {
  /** When true, appends a short technical footer with the detected strategy type and ambiguity level. */
  includeAuditFooter?: boolean;
};

/**
 * Renders a `ClarificationResponseCandidateResult` as human-readable text, independent of the
 * production Response Composer. Always makes explicit that nothing was executed, no task was
 * created, no email was sent, and a reply from the user is required to route this correctly.
 */
export function formatClarificationResponseCandidate(
  result: ClarificationResponseCandidateResult,
  options: FormatClarificationResponseCandidateOptions = {},
): string {
  const lines: string[] = [];

  lines.push("Te ayudo. Para ubicarlo bien, necesito una pista rápida:");
  lines.push("");
  lines.push(result.primaryQuestion.question);
  lines.push("");

  if (result.suggestedRouteOptions.length > 0) {
    lines.push("Podés responder con una de estas rutas:");
    result.suggestedRouteOptions.forEach((option, index) => {
      lines.push(`${index + 1}. ${option.label} — ${option.description}`);
    });
    lines.push("");
  }

  if (result.secondaryQuestions.length > 0) {
    lines.push("También ayuda si me decís:");
    for (const question of result.secondaryQuestions) {
      lines.push(`- ${question.question}`);
    }
    lines.push("");
  }

  lines.push("También podés pegar el correo, nota o contexto que querés que revise.");
  lines.push("");

  lines.push(
    "Nota: no ejecuté ninguna acción, no creé ninguna tarea, no envié ningún correo y no escribí nada en la base " +
      "de datos — solo estoy pidiendo aclaración para rutearlo bien. Quedo a la espera de tu respuesta.",
  );

  if (options.includeAuditFooter) {
    lines.push("");
    lines.push(
      `(Estrategia candidata v${result.auditMetadata.strategyVersion} — tipo: ${result.strategyType}, ambigüedad: ` +
        `${result.ambiguityLevel}. No conectada a producción.)`,
    );
  }

  return lines.join("\n");
}

export type ClarificationResponseStrategyExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  inputContract: string[];
  outputContract: string[];
  strategyTypesSupported: string[];
  safetyGuarantees: string[];
  humanReplyPolicy: string;
  limitations: string[];
  connectionToProduction: string;
};

export function explainClarificationResponseStrategy(): ClarificationResponseStrategyExplain {
  return {
    capability: "playbook-engine-conversation-clarification-response-strategy",
    purpose:
      "Answers ambiguous PM messages with a structured, deterministic clarifying response (acknowledgment, a " +
      "primary question, up to three secondary questions, and plausible route options) — as an isolated " +
      "capability, not wired to the production router, composer, any handler, or the endpoint.",
    doesNot: [
      "Does not call the router, composer, or any production handler.",
      "Does not touch POST /api/command-center/chat or runConversationalBrainGateway().",
      "Does not read or write a database, call Supabase, send email, create tasks, or execute any action.",
      "Does not call an LLM or any external API — fully deterministic and local.",
      "Does not activate a feature flag or the enriched classifier in production.",
      "Does not implement a persistent, multi-turn clarification loop — each call is a single, stateless turn.",
    ],
    inputContract: [
      "input.input: the raw ambiguous message (required, non-empty string).",
      "input.availableContext: optional known facts (project, recent messages, attached context, detected entities/hints, previous intent/route/question) used only to reduce missing slots — never fetched, always caller-supplied.",
      "input.now: optional ISO timestamp for auditMetadata.generatedAt — this module never reads the system clock itself.",
    ],
    outputContract: [
      "ClarificationResponseCandidateResult: strategyType, ambiguityLevel, missingSlots, suggestedRouteOptions, primaryQuestion, secondaryQuestions, responseText, tone, safety, auditMetadata, warnings.",
      "safety is always { shouldExecuteAction: false, shouldCreateTask: false, shouldSendEmail: false, shouldWriteToDb: false, requiresUserReply: true, productionRoutingEnabled: false, maxQuestionsRecommended: 3 }.",
    ],
    strategyTypesSupported: [
      "generic_ambiguous",
      "review_without_context",
      "follow_up_ambiguous",
      "concern_without_domain",
      "stalled_progress_ambiguous",
      "communication_hint_ambiguous",
      "task_hint_ambiguous",
      "risk_hint_ambiguous",
      "status_hint_ambiguous",
      "decision_hint_ambiguous",
      "context_missing_for_known_route",
    ],
    safetyGuarantees: [
      "Every code path returns safety.shouldExecuteAction === false.",
      "No task, email, or database write is ever produced or attempted.",
      "responseText always states explicitly that nothing was executed, no task was created, and no email was sent.",
      "The response never asks more than three secondary questions (four total including the primary).",
    ],
    humanReplyPolicy:
      "requiresUserReply is always true. The strategy never guesses a route on the user's behalf — it always " +
      "returns a question and waits for the next turn, which a future router could use to route correctly.",
    limitations: [
      "Keyword-based detection, not full NLP.",
      "Fixed, per-strategy-type route option and question tables, not tailored to exact wording.",
      "Does not implement a persistent clarification loop — no conversational state is stored between calls.",
    ],
    connectionToProduction:
      "None. This strategy is not imported by router/brainRouter.ts, composer/responseComposer.ts, any " +
      "handlers/*.ts, conversationalBrainGateway.ts, or POST /api/command-center/chat. See " +
      "docs/conversational-brain-clarification-response-strategy.md for the criteria to connect it in a future sprint.",
  };
}
