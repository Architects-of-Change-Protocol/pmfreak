/**
 * Sprint 19R — Decision Support Candidate Handler.
 *
 * A pure, read-only, isolated candidate handler for decision-shaped PM messages ("qué opción
 * debería escoger", "conviene escalar o esperar", "deberíamos cerrar ya o pedir más evidencia").
 * It is NOT wired to the router, composer, any production handler, or `POST
 * /api/command-center/chat` — see `docs/conversational-brain-decision-support-candidate-handler.md`
 * for the full scope, safety guarantees, and why this stays disconnected from production for now.
 *
 * `handleDecisionSupportCandidate()` never executes an action, never creates a task, never sends a
 * communication, never writes to a database, never calls Supabase/Gmail, never calls an LLM, and
 * never calls `fetch`. Every field in the returned `safety` object documents this explicitly.
 */

import {
  buildDecisionStatement,
  detectDecisionType,
  detectDecisionTypeWithDetail,
  estimateDecisionConfidence,
  extractDecisionOptions,
  identifyDecisionRisks,
  identifyDecisionTradeoffs,
  identifyEvidenceNeeds,
  normalizeDecisionSupportInput,
} from "./decisionSupportAnalyzer";
import type {
  DecisionSupportAuditMetadata,
  DecisionSupportCandidateResult,
  DecisionSupportConfidence,
  DecisionSupportEvidenceNeed,
  DecisionSupportInput,
  DecisionSupportOption,
  DecisionSupportRecommendation,
  DecisionSupportRisk,
  DecisionSupportSafety,
  DecisionSupportTradeoff,
} from "./decisionSupportCandidateTypes";

export const DECISION_SUPPORT_CANDIDATE_HANDLER_VERSION = "19R.1.0";

const RECOMMENDED_PATH_BY_DECISION_TYPE: Record<DecisionSupportCandidateResult["detectedDecisionType"], string> = {
  bill_or_wait:
    "Facturar solo si existe evidencia de entrega/aceptación suficiente; si no, esperar la recepción formal antes de facturar.",
  escalate_or_wait:
    "Escalar si ya existe un plazo vencido o el bloqueo tiene impacto alto; de lo contrario, dar un margen breve antes de escalar.",
  close_or_continue:
    "Cerrar formalmente solo si no quedan observaciones abiertas; si hay pendientes, mantenerlo abierto y pedir la evidencia faltante antes de cerrar.",
  accept_or_mitigate_risk:
    "Aceptar el riesgo únicamente si su severidad e impacto son bajos y está aprobado explícitamente; si no, priorizar la mitigación.",
  change_vendor_or_continue:
    "Presionar primero al proveedor actual con plazos concretos; escalar a un cambio de proveedor solo si no hay mejora medible.",
  approve_or_request_evidence:
    "Aprobar si la evidencia actual cubre el criterio de aprobación; si no, solicitar la evidencia faltante antes de aprobar.",
  prioritize_next_step: "Priorizar el paso que desbloquea más dependencias o tiene el plazo más próximo.",
  identify_missing_decision: "Nombrar explícitamente quién es el dueño de la decisión pendiente y fijar una fecha límite para resolverla.",
  choose_between_options:
    "Elegir la opción con mejor relación entre impacto, reversibilidad y alineación con los stakeholders involucrados.",
  general_decision_support: "Reunir las opciones concretas y el contexto faltante antes de comprometerse con un camino.",
};

const CLARIFICATION_QUESTION_BY_DECISION_TYPE: Record<DecisionSupportCandidateResult["detectedDecisionType"], string> = {
  bill_or_wait: "¿Ya existe acta de recepción o aceptación escrita del cliente para este entregable?",
  escalate_or_wait: "¿Hay un plazo o SLA ya vencido, y quién sería el stakeholder al que le corresponde escalar?",
  close_or_continue: "¿Qué observaciones o pendientes quedan abiertos antes de poder cerrar formalmente?",
  accept_or_mitigate_risk: "¿Cuál es la severidad y probabilidad de este riesgo, y qué mitigaciones existen disponibles?",
  change_vendor_or_continue: "¿Qué evidencia concreta hay del desempeño del proveedor y qué alternativas existen realmente?",
  approve_or_request_evidence: "¿Qué evidencia ya existe y cuál es el criterio mínimo para aprobar?",
  prioritize_next_step: "¿Cuáles son los pendientes concretos y qué dependencias tiene cada uno?",
  identify_missing_decision: "¿Quién es el owner natural de esta decisión y hay alguna fecha límite implícita?",
  choose_between_options: "¿Podrías nombrar las opciones concretas que estás evaluando y qué te importa más al elegir?",
  general_decision_support: "¿Podrías indicar qué opciones concretas estás evaluando y qué contexto o evidencia ya tenés disponible?",
};

function buildRecommendation(
  decisionType: DecisionSupportCandidateResult["detectedDecisionType"],
  options: DecisionSupportOption[],
  tradeoffs: DecisionSupportTradeoff[],
  risks: DecisionSupportRisk[],
  confidence: DecisionSupportConfidence,
): DecisionSupportRecommendation {
  const shouldAskClarifyingQuestion = confidence === "low";

  const rationale: string[] = [];
  if (tradeoffs[0]) rationale.push(`Tradeoff principal: ${tradeoffs[0].summary}`);
  if (risks[0]) rationale.push(`Riesgo principal: ${risks[0].description}`);

  const confidenceReason =
    confidence === "high"
      ? "Se detectaron dos o más opciones claras y hay contexto o evidencia disponible en availableContext."
      : confidence === "medium"
        ? "La decisión es clara pero el contexto o la evidencia disponible es limitada."
        : "La decisión es ambigua o faltan opciones/contexto suficientes para recomendar con mayor certeza.";

  const caveats = [
    "Esta es una recomendación candidata generada sin evidencia externa verificada; requiere validación humana antes de ejecutar cualquier acción.",
  ];
  if (confidence === "low") {
    caveats.push("No se detectaron opciones concretas ni contexto suficiente; conviene pedir más información antes de decidir.");
  }

  return {
    recommendedOptionId: confidence === "low" ? undefined : options[0]?.id,
    recommendedPath: RECOMMENDED_PATH_BY_DECISION_TYPE[decisionType],
    rationale,
    confidence,
    confidenceReason,
    caveats,
    suggestedNextStep: `Confirmar con el equipo o stakeholder correspondiente antes de proceder con: ${RECOMMENDED_PATH_BY_DECISION_TYPE[decisionType]}`,
    shouldAskClarifyingQuestion,
    clarificationQuestion: shouldAskClarifyingQuestion ? CLARIFICATION_QUESTION_BY_DECISION_TYPE[decisionType] : undefined,
  };
}

function buildAuditMetadata(
  matchedPatterns: string[],
  optionExtractionStrategy: string,
  now?: string,
): DecisionSupportAuditMetadata {
  return {
    handlerVersion: DECISION_SUPPORT_CANDIDATE_HANDLER_VERSION,
    generatedAt: now,
    matchedPatterns,
    optionExtractionStrategy,
    recommendationStrategy: "deterministic-template-per-decision-type",
    limitations: [
      "Keyword/connector-based detection, not full NLP — see explainDecisionSupportAnalysis() for the full rule set.",
      "Does not reuse the DecisionDraft data from operational-intelligence-engine.ts yet (documented Sprint 20R candidate).",
      "Not connected to the production router, composer, or endpoint — candidate only.",
    ],
  };
}

const SAFETY: DecisionSupportSafety = {
  shouldExecuteAction: false,
  shouldCreateTask: false,
  shouldSendEmail: false,
  shouldWriteToDb: false,
  requiresHumanConfirmation: true,
  productionRoutingEnabled: false,
};

/**
 * Runs the full candidate analysis pipeline for a single decision-shaped message: validates the
 * input, normalizes it, detects a decision type, extracts options, builds a decision statement,
 * identifies tradeoffs/risks/evidence needs, estimates confidence, and builds a recommendation.
 * Pure and deterministic — never calls fetch, a database, Supabase, Gmail, or an LLM, and never
 * executes an action, creates a task, or sends a communication.
 */
export function handleDecisionSupportCandidate(input: DecisionSupportInput): DecisionSupportCandidateResult {
  if (!input || typeof input.input !== "string" || input.input.trim().length === 0) {
    throw new Error("handleDecisionSupportCandidate: input.input must be a non-empty string.");
  }

  const warnings: string[] = [];
  const normalizedInput = normalizeDecisionSupportInput(input.input);
  const { decisionType, matchedPatterns } = detectDecisionTypeWithDetail(input.input);
  const options = extractDecisionOptions(input.input, input.availableContext);
  const decisionStatement = buildDecisionStatement(input.input, decisionType, options);
  const tradeoffs = identifyDecisionTradeoffs(input.input, options, input.availableContext);
  const risks = identifyDecisionRisks(input.input, options, input.availableContext);
  const evidenceNeeded: DecisionSupportEvidenceNeed[] = identifyEvidenceNeeds(
    input.input,
    decisionType,
    options,
    input.availableContext,
  );
  const confidence = estimateDecisionConfidence(input.input, options, input.availableContext);
  const recommendation = buildRecommendation(decisionType, options, tradeoffs, risks, confidence);

  if (!options.some((o) => o.detectedFromInput)) {
    warnings.push("No concrete options were detected from the input text — every option returned is a generic placeholder.");
  }

  const optionExtractionStrategy = options.every((o) => o.detectedFromInput)
    ? "canned-or-connector-extracted"
    : "generic-placeholder-fallback";

  return {
    kind: "decision_support_candidate_result",
    input: input.input,
    normalizedInput,
    decisionStatement,
    detectedDecisionType: decisionType,
    options,
    tradeoffs,
    risks,
    evidenceNeeded,
    recommendation,
    safety: SAFETY,
    auditMetadata: buildAuditMetadata(matchedPatterns, optionExtractionStrategy, input.now),
    warnings,
  };
}

export type FormatDecisionSupportCandidateResponseOptions = {
  /** When true, appends a short technical footer with the detected decision type and confidence. */
  includeAuditFooter?: boolean;
};

/**
 * Renders a `DecisionSupportCandidateResult` as human-readable text, independent of the production
 * Response Composer. Always makes explicit that nothing was executed, no task was created, no
 * email was sent, and human validation is required before acting on anything discussed.
 */
export function formatDecisionSupportCandidateResponse(
  result: DecisionSupportCandidateResult,
  options: FormatDecisionSupportCandidateResponseOptions = {},
): string {
  const lines: string[] = [];

  lines.push("## Decisión a resolver");
  lines.push(result.decisionStatement);
  lines.push("");

  lines.push("## Opciones detectadas");
  result.options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.label} — ${option.description}`);
  });
  lines.push("");

  lines.push("## Tradeoffs principales");
  for (const tradeoff of result.tradeoffs) {
    lines.push(`- ${tradeoff.summary}`);
  }
  lines.push("");

  lines.push("## Riesgos");
  for (const risk of result.risks) {
    lines.push(`- ${risk.description}${risk.mitigation ? ` (mitigación sugerida: ${risk.mitigation})` : ""}`);
  }
  lines.push("");

  lines.push("## Evidencia que conviene confirmar");
  for (const evidence of result.evidenceNeeded) {
    lines.push(`- ${evidence.description}: ${evidence.reason}`);
  }
  lines.push("");

  lines.push("## Recomendación candidata");
  lines.push(result.recommendation.recommendedPath);
  if (result.recommendation.caveats.length > 0) {
    lines.push(`Caveats: ${result.recommendation.caveats.join(" ")}`);
  }
  if (result.recommendation.shouldAskClarifyingQuestion && result.recommendation.clarificationQuestion) {
    lines.push(`Antes de recomendar con más confianza: ${result.recommendation.clarificationQuestion}`);
  }
  lines.push("");

  lines.push("## Siguiente paso sugerido");
  lines.push(result.recommendation.suggestedNextStep);
  lines.push("");

  lines.push(
    "Nota: esta es una recomendación candidata. No se ejecutó ninguna acción, no se creó ninguna tarea y no se " +
      "envió ningún correo — requiere validación humana antes de ejecutar cualquier acción.",
  );

  if (options.includeAuditFooter) {
    lines.push("");
    lines.push(
      `(Handler candidato v${result.auditMetadata.handlerVersion} — tipo detectado: ${result.detectedDecisionType}, ` +
        `confianza: ${result.recommendation.confidence}. No conectado a producción.)`,
    );
  }

  return lines.join("\n");
}

export type DecisionSupportCandidateHandlerExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  inputContract: string[];
  outputContract: string[];
  decisionTypesSupported: string[];
  safetyGuarantees: string[];
  humanConfirmationPolicy: string;
  limitations: string[];
  connectionToProduction: string;
};

export function explainDecisionSupportCandidateHandler(): DecisionSupportCandidateHandlerExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-candidate-handler",
    purpose:
      "Answers decision-shaped PM questions with a structured, deterministic analysis (decision statement, options, " +
      "tradeoffs, risks, evidence needed, and a candidate recommendation) — as an isolated capability, not wired to " +
      "the production router, composer, any handler, or the endpoint.",
    doesNot: [
      "Does not call the router, composer, or any production handler.",
      "Does not touch POST /api/command-center/chat or runConversationalBrainGateway().",
      "Does not read or write a database, call Supabase, send email, create tasks, or execute any action.",
      "Does not call an LLM or any external API — fully deterministic and local.",
      "Does not activate a feature flag or the enriched classifier in production.",
    ],
    inputContract: [
      "input.input: the raw decision-shaped message (required, non-empty string).",
      "input.availableContext: optional known facts (risks, issues, dependencies, constraints, evidence, stakeholder preferences) used only to raise confidence — never fetched, always caller-supplied.",
      "input.now: optional ISO timestamp for auditMetadata.generatedAt — this module never reads the system clock itself.",
    ],
    outputContract: [
      "DecisionSupportCandidateResult: decisionStatement, detectedDecisionType, options, tradeoffs, risks, evidenceNeeded, recommendation, safety, auditMetadata, warnings.",
      "safety is always { shouldExecuteAction: false, shouldCreateTask: false, shouldSendEmail: false, shouldWriteToDb: false, requiresHumanConfirmation: true, productionRoutingEnabled: false }.",
    ],
    decisionTypesSupported: [
      "choose_between_options",
      "escalate_or_wait",
      "close_or_continue",
      "bill_or_wait",
      "accept_or_mitigate_risk",
      "change_vendor_or_continue",
      "approve_or_request_evidence",
      "prioritize_next_step",
      "identify_missing_decision",
      "general_decision_support",
    ],
    safetyGuarantees: [
      "Every code path returns safety.shouldExecuteAction === false.",
      "No task, email, or database write is ever produced or attempted.",
      "recommendation is always framed as a candidate requiring human confirmation, never as an executed decision.",
    ],
    humanConfirmationPolicy:
      "requiresHumanConfirmation is always true. Low-confidence results additionally set " +
      "shouldAskClarifyingQuestion: true and provide a clarificationQuestion rather than a recommendedOptionId.",
    limitations: [
      "Keyword/connector-based detection, not full NLP.",
      "Deterministic tradeoffs/risks/evidence per decisionType, not tailored to exact wording.",
      "Does not yet reuse the DecisionDraft data from operational-intelligence-engine.ts (documented Sprint 20R candidate).",
    ],
    connectionToProduction:
      "None. This handler is not imported by router/brainRouter.ts, composer/responseComposer.ts, any handlers/*.ts, " +
      "conversationalBrainGateway.ts, or POST /api/command-center/chat. See " +
      "docs/conversational-brain-decision-support-candidate-handler.md for the criteria to connect it in a future sprint.",
  };
}
