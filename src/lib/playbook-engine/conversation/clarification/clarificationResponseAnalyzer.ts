/**
 * Sprint 22R — Clarification Response Strategy: pure analyzer.
 *
 * Every export in this file is a pure, deterministic function over its arguments: no `fetch`, no
 * database/Supabase/Gmail access, no LLM call, no import from the router/composer/handlers/gateway,
 * and no side effects. Given the same input, every function here always returns the same output.
 *
 * This analyzer answers a narrower question than the production/enriched classifiers: given a
 * message that is already ambiguous (or a candidate for ambiguity), which *flavor* of ambiguity is
 * it, what is missing to route it safely, and what should we ask the user? It does not compete
 * against the eight other production categories — that boundary is Sprint 17R/18R/21R's job (see
 * `docs/conversational-brain-decision-support-classifier-boundary.md` and
 * `docs/conversational-brain-decision-support-clarification-architecture.md`).
 *
 * See `docs/conversational-brain-clarification-response-strategy.md` for the full design writeup.
 */

import type {
  ClarificationAmbiguityLevel,
  ClarificationAvailableContext,
  ClarificationMissingSlot,
  ClarificationQuestion,
  ClarificationRouteOption,
  ClarificationRouteOptionIntent,
  ClarificationStrategyType,
} from "./clarificationResponseTypes";

// ─── Normalization ───────────────────────────────────────────────────────────────────

/**
 * Strips accents/diacritics and inverted punctuation, lowercases, and collapses whitespace.
 * Stable and deterministic: the same input always normalizes to the same output.
 */
export function normalizeClarificationInput(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿¡]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Strategy type detection ─────────────────────────────────────────────────────────

type ClarificationSignalCheck = { name: string; test: (norm: string) => boolean };

type ClarificationTypeRule = {
  type: ClarificationStrategyType;
  signals: ClarificationSignalCheck[];
};

const CONTEXT_MISSING_RULE: ClarificationTypeRule = {
  type: "context_missing_for_known_route",
  signals: [
    { name: "redactar_vago", test: (n) => /\bredact(a|ame|emos)\b/.test(n) && /\b(eso|esto)\b/.test(n) },
    {
      name: "crear_tarea_vaga",
      test: (n) => /\bcrea(me|mos)?\b/.test(n) && /\btarea\b/.test(n) && /\b(esa|ese|esto|eso)\b/.test(n),
    },
    { name: "facturar_vago", test: (n) => /\bfactura(mos)?\b|\bcobra(mos)?\b/.test(n) && /\b(eso|esto)\b/.test(n) },
    { name: "cerrar_vago", test: (n) => /\bcerra(mos)?\b|\bcierro\b/.test(n) && /\b(eso|esto)\b/.test(n) },
    { name: "escalar_vago", test: (n) => /\bescala(mos)?\b|\bescalo\b/.test(n) && /\b(eso|esto)\b/.test(n) },
  ],
};

const COMMUNICATION_HINT_RULE: ClarificationTypeRule = {
  type: "communication_hint_ambiguous",
  signals: [
    { name: "decirle_algo", test: (n) => /\b(habria que )?decirle algo\b/.test(n) },
    { name: "responderle", test: (n) => /\b(hay que )?responderle\b/.test(n) },
    { name: "escribirle", test: (n) => /\b(deberiamos )?escribirle\b/.test(n) },
    { name: "comunicar_esto", test: (n) => /\b(hay que )?comunicar esto\b/.test(n) },
    { name: "mandarle_algo", test: (n) => /\bmandemosle algo\b/.test(n) },
    { name: "avisarle", test: (n) => /\b(hay que )?avisarle\b/.test(n) },
  ],
};

const TASK_HINT_RULE: ClarificationTypeRule = {
  type: "task_hint_ambiguous",
  signals: [
    { name: "alguien_tiene_que_ver", test: (n) => /\balguien tiene que ver esto\b/.test(n) },
    { name: "esta_pendiente", test: (n) => /\b(eso|esto) esta pendiente\b/.test(n) },
    { name: "asignarlo", test: (n) => /\b(hay que )?asignarlo\b/.test(n) },
    { name: "hacer_algo", test: (n) => /\bhay que hacer algo\b/.test(n) },
    { name: "que_alguien_revise", test: (n) => /\bque alguien lo revise\b/.test(n) },
    { name: "pongamos_pendientes", test: (n) => /\bpongamos esto en pendientes\b/.test(n) },
  ],
};

const RISK_HINT_RULE: ClarificationTypeRule = {
  type: "risk_hint_ambiguous",
  signals: [
    { name: "puede_ser_problema", test: (n) => /\besto puede ser un problema\b/.test(n) },
    { name: "se_ve_riesgoso", test: (n) => /\bse ve riesgoso\b/.test(n) },
    { name: "podria_complicarse", test: (n) => /\bpodria complicarse\b/.test(n) },
    { name: "nos_puede_pegar", test: (n) => /\bnos puede pegar\b/.test(n) },
    { name: "puede_atrasarnos", test: (n) => /\bpuede atrasarnos\b/.test(n) },
  ],
};

const STATUS_HINT_RULE: ClarificationTypeRule = {
  type: "status_hint_ambiguous",
  signals: [
    { name: "como_esta_esto", test: (n) => /\bcomo esta esto\b/.test(n) },
    { name: "en_que_va_esto", test: (n) => /\ben que va esto\b/.test(n) },
    { name: "donde_estamos_con_esto", test: (n) => /\bdonde estamos con esto\b/.test(n) },
    { name: "como_va_esto", test: (n) => /\bcomo va esto\b/.test(n) },
    { name: "estado_de_esto", test: (n) => /\b(cual es el )?estado de esto\b/.test(n) },
  ],
};

const DECISION_HINT_RULE: ClarificationTypeRule = {
  type: "decision_hint_ambiguous",
  signals: [
    { name: "hay_que_decidir_algo", test: (n) => /\bhay que decidir algo\b/.test(n) },
    { name: "requiere_decision", test: (n) => /\besto requiere decision\b/.test(n) },
    { name: "tenemos_que_decidir", test: (n) => /\btenemos que decidir\b/.test(n) },
    { name: "no_se_que_decision", test: (n) => /\bno se que decision tomar\b/.test(n) },
    { name: "hay_que_escoger", test: (n) => /\bhay que escoger\b/.test(n) },
  ],
};

const STALLED_PROGRESS_RULE: ClarificationTypeRule = {
  type: "stalled_progress_ambiguous",
  signals: [
    { name: "no_avanza", test: (n) => /\besto no avanza\b/.test(n) },
    { name: "esta_bloqueado", test: (n) => /\besto esta bloqueado\b/.test(n) },
    { name: "no_me_respondieron", test: (n) => /\bno me respondieron\b/.test(n) },
    { name: "estamos_pegados", test: (n) => /\bestamos pegados\b/.test(n) },
    { name: "esta_detenido", test: (n) => /\besto esta detenido\b/.test(n) },
    { name: "nadie_responde", test: (n) => /\bnadie responde\b/.test(n) },
    { name: "no_se_mueve", test: (n) => /\bno se mueve\b/.test(n) },
  ],
};

const CONCERN_WITHOUT_DOMAIN_RULE: ClarificationTypeRule = {
  type: "concern_without_domain",
  signals: [
    { name: "me_preocupa_esto", test: (n) => /\bme preocupa esto\b/.test(n) },
    { name: "esto_esta_raro", test: (n) => /\besto esta raro\b/.test(n) },
    { name: "algo_no_me_cuadra", test: (n) => /\balgo no me cuadra\b/.test(n) },
    { name: "esto_no_me_gusta", test: (n) => /\besto no me gusta\b/.test(n) },
    { name: "hay_algo_raro", test: (n) => /\bhay algo raro\b/.test(n) },
    { name: "no_me_gusta_como_va", test: (n) => /\bno me gusta como va esto\b/.test(n) },
  ],
};

const FOLLOW_UP_RULE: ClarificationTypeRule = {
  type: "follow_up_ambiguous",
  signals: [
    { name: "dale_seguimiento", test: (n) => /\bdale seguimiento\b/.test(n) },
    { name: "hay_que_darle_seguimiento", test: (n) => /\bhay que darle seguimiento\b/.test(n) },
    { name: "segui_con_esto", test: (n) => /\bsegui con esto\b/.test(n) },
    { name: "sigamos_con_esto", test: (n) => /\bsigamos con esto\b/.test(n) },
    { name: "mueve_esto", test: (n) => /\bmove esto\b/.test(n) },
    { name: "hay_que_mover_esto", test: (n) => /\bhay que mover esto\b/.test(n) },
  ],
};

const REVIEW_WITHOUT_CONTEXT_RULE: ClarificationTypeRule = {
  type: "review_without_context",
  signals: [
    { name: "revisa_esto", test: (n) => /\brevis(a|ame)? esto\b/.test(n) },
    { name: "analiza_esto", test: (n) => /\banaliz(a|ame)? esto\b/.test(n) },
    { name: "mira_esto", test: (n) => /\bmira esto\b/.test(n) },
    { name: "ve_esto", test: (n) => /\bve esto\b/.test(n) },
    { name: "pegale_revisada", test: (n) => /\bpegale una revisada\b/.test(n) },
    { name: "dale_revisada", test: (n) => /\bdale una revisada\b/.test(n) },
  ],
};

const GENERIC_AMBIGUOUS_RULE: ClarificationTypeRule = {
  type: "generic_ambiguous",
  signals: [
    { name: "ayuda", test: (n) => /\bayuda\b/.test(n) },
    { name: "que_hacemos", test: (n) => /\bque hacemos\b/.test(n) },
    { name: "que_opinas", test: (n) => /\bque opinas\b/.test(n) },
    { name: "ves_algo_raro", test: (n) => /\bves algo raro\b/.test(n) },
    { name: "no_se_que_hacer", test: (n) => /\bno se que hacer\b/.test(n) },
    { name: "como_seguimos", test: (n) => /\bcomo seguimos\b/.test(n) },
    { name: "que_procede", test: (n) => /\bque procede\b/.test(n) },
    { name: "que_sigue", test: (n) => /\bque sigue\b/.test(n) },
  ],
};

/**
 * Ordered from most domain-specific first (a message with a clear-but-orphaned action verb) down to
 * the bare, no-signal-at-all fallback (`generic_ambiguous`) — the first matching rule wins, mirroring
 * `decisionSupportAnalyzer.ts`'s `DECISION_TYPE_RULES` ordering discipline.
 */
const CLARIFICATION_TYPE_RULES: ClarificationTypeRule[] = [
  CONTEXT_MISSING_RULE,
  // Checked ahead of status/task/risk/communication hints: "no me gusta cómo va esto" would otherwise
  // match status_hint_ambiguous's bare "como va esto" substring before this rule gets a chance to fire.
  CONCERN_WITHOUT_DOMAIN_RULE,
  COMMUNICATION_HINT_RULE,
  TASK_HINT_RULE,
  RISK_HINT_RULE,
  STATUS_HINT_RULE,
  DECISION_HINT_RULE,
  STALLED_PROGRESS_RULE,
  FOLLOW_UP_RULE,
  REVIEW_WITHOUT_CONTEXT_RULE,
  GENERIC_AMBIGUOUS_RULE,
];

export type ClarificationTypeDetectionDetail = {
  strategyType: ClarificationStrategyType;
  matchedPatterns: string[];
};

/**
 * Detects which of the eleven clarification strategy types a message belongs to. Deterministic
 * keyword/connector matching, evaluated in priority order (most domain-specific signal first);
 * `generic_ambiguous` is both a named category (bare phrases like "ayuda") and the safe fallback
 * when nothing more specific fires.
 */
export function detectClarificationStrategyTypeWithDetail(input: string): ClarificationTypeDetectionDetail {
  const norm = normalizeClarificationInput(input);
  for (const rule of CLARIFICATION_TYPE_RULES) {
    const matched = rule.signals.filter((s) => s.test(norm)).map((s) => `${rule.type}:${s.name}`);
    if (matched.length > 0) return { strategyType: rule.type, matchedPatterns: matched };
  }
  return { strategyType: "generic_ambiguous", matchedPatterns: ["generic_ambiguous:fallback_no_specific_pattern"] };
}

export function detectClarificationStrategyType(
  input: string,
  context?: ClarificationAvailableContext,
): ClarificationStrategyType {
  return detectClarificationStrategyTypeWithDetail(input).strategyType;
}

export function detectClarificationSignals(input: string, context?: ClarificationAvailableContext): string[] {
  return detectClarificationStrategyTypeWithDetail(input).matchedPatterns;
}

// ─── Missing slot inference ───────────────────────────────────────────────────────────

const SLOT_ORDER: ClarificationMissingSlot[] = [
  "project",
  "intent",
  "source_context",
  "desired_output",
  "urgency",
  "owner",
  "recipient",
  "evidence",
  "decision_options",
  "action_authorization",
  "timeframe",
];

function sortSlots(slots: ClarificationMissingSlot[]): ClarificationMissingSlot[] {
  return Array.from(new Set(slots)).sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
}

const GENERIC_INTENT_TYPES = new Set<ClarificationStrategyType>([
  "generic_ambiguous",
  "concern_without_domain",
  "follow_up_ambiguous",
]);

const DESIRED_OUTPUT_AMBIGUOUS_TYPES = new Set<ClarificationStrategyType>([
  "generic_ambiguous",
  "review_without_context",
  "concern_without_domain",
  "stalled_progress_ambiguous",
  "follow_up_ambiguous",
]);

const URGENCY_TYPES = new Set<ClarificationStrategyType>(["stalled_progress_ambiguous", "concern_without_domain"]);
const OWNER_TYPES = new Set<ClarificationStrategyType>(["follow_up_ambiguous", "task_hint_ambiguous"]);
const ACTION_AUTHORIZATION_TEXT_TYPES = new Set<ClarificationStrategyType>(["follow_up_ambiguous", "task_hint_ambiguous"]);

/**
 * Infers which of the eleven `ClarificationMissingSlot` values are missing for this message, given
 * its detected strategy type and whatever context the caller already has available. Pure and
 * deterministic — a slot is "missing" only based on the input text and the caller-supplied
 * `context`, never fetched or guessed from an external source.
 */
export function inferMissingSlots(
  input: string,
  strategyType: ClarificationStrategyType,
  context?: ClarificationAvailableContext,
): ClarificationMissingSlot[] {
  const norm = normalizeClarificationInput(input);
  const { matchedPatterns } = detectClarificationStrategyTypeWithDetail(input);
  const slots: ClarificationMissingSlot[] = [];

  const hasProject = Boolean(
    context?.knownProjectName || context?.knownProjectId || (context?.detectedProjectHints?.length ?? 0) > 0,
  );
  if (!hasProject) slots.push("project");

  if (GENERIC_INTENT_TYPES.has(strategyType)) slots.push("intent");

  const referencesVagueObject = /\b(esto|eso|esta|ese|esa)\b/.test(norm);
  const hasSourceContext = Boolean(
    (context?.recentMessages?.length ?? 0) > 0 || context?.attachedContextSummary || (context?.detectedEntities?.length ?? 0) > 0,
  );
  if (referencesVagueObject && !hasSourceContext) slots.push("source_context");

  if (DESIRED_OUTPUT_AMBIGUOUS_TYPES.has(strategyType)) slots.push("desired_output");
  if (URGENCY_TYPES.has(strategyType)) slots.push("urgency");
  if (OWNER_TYPES.has(strategyType)) slots.push("owner");
  if (strategyType === "communication_hint_ambiguous") slots.push("recipient");
  if (strategyType === "decision_hint_ambiguous") {
    slots.push("decision_options");
    slots.push("evidence");
  }

  if (strategyType === "context_missing_for_known_route") {
    if (matchedPatterns.some((p) => p.includes("facturar_vago") || p.includes("cerrar_vago"))) slots.push("evidence");
    if (matchedPatterns.some((p) => p.includes("escalar_vago"))) slots.push("action_authorization");
  }
  if (ACTION_AUTHORIZATION_TEXT_TYPES.has(strategyType) && /\bmov|\basign|\bsegu/.test(norm)) {
    slots.push("action_authorization");
  }

  return sortSlots(slots);
}

// ─── Route option inference ───────────────────────────────────────────────────────────

const ROUTE_OPTION_CATALOG: Record<ClarificationRouteOptionIntent, Omit<ClarificationRouteOption, "priority">> = {
  project_status_question: {
    intent: "project_status_question",
    label: "Estado / avance del proyecto",
    description: "Revisar el estado, avance o salud general del proyecto.",
    exampleUserReply: "Quiero ver el estado del proyecto X.",
  },
  risk_analysis: {
    intent: "risk_analysis",
    label: "Riesgos, issues o bloqueos",
    description: "Identificar riesgos, issues o dependencias que puedan estar bloqueando el avance.",
    exampleUserReply: "Revisá los riesgos abiertos del proyecto X.",
  },
  communication_draft: {
    intent: "communication_draft",
    label: "Comunicación / correo / minuta",
    description: "Redactar un correo, minuta o seguimiento para un stakeholder o cliente.",
    exampleUserReply: "Redactame un correo para el cliente sobre el retraso.",
  },
  task_or_action_request: {
    intent: "task_or_action_request",
    label: "Tarea o seguimiento",
    description: "Crear, asignar o dar seguimiento a una tarea o acción concreta.",
    exampleUserReply: "Creá una tarea para revisar esto, asignada a Arturo.",
  },
  closure_question: {
    intent: "closure_question",
    label: "Cierre del proyecto",
    description: "Revisar qué falta para cerrar formalmente el proyecto.",
    exampleUserReply: "Qué falta para cerrar el proyecto X.",
  },
  billing_question: {
    intent: "billing_question",
    label: "Facturación / cobranza",
    description: "Revisar qué falta para facturar o cobrar.",
    exampleUserReply: "Qué falta para facturar el proyecto X.",
  },
  recommendation_request: {
    intent: "recommendation_request",
    label: "Recomendación del playbook",
    description: "Pedir la recomendación del playbook o la siguiente mejor acción.",
    exampleUserReply: "Qué recomienda el playbook para el proyecto X.",
  },
  decision_support: {
    intent: "decision_support",
    label: "Decisión entre alternativas",
    description: "Ayudarte a decidir entre dos o más caminos posibles.",
    exampleUserReply: "Tengo que decidir entre A o B para el proyecto X.",
  },
  governance_question: {
    intent: "governance_question",
    label: "Gobernanza / evidencia pendiente",
    description: "Revisar aprobaciones pendientes o evidencia faltante.",
    exampleUserReply: "Qué evidencia falta para el proyecto X.",
  },
  audit_question: {
    intent: "audit_question",
    label: "Auditoría / trazabilidad",
    description: "Revisar por qué se recomendó algo o el historial de una decisión.",
    exampleUserReply: "Por qué se recomendó esto para el proyecto X.",
  },
  general_pm_advice: {
    intent: "general_pm_advice",
    label: "Consejo general de PM",
    description: "Recibir orientación general de buenas prácticas de PM.",
    exampleUserReply: "Cómo manejarías un cliente difícil en este caso.",
  },
  unsupported: {
    intent: "unsupported",
    label: "Otro",
    description: "Algo distinto a las opciones anteriores — contame más.",
    exampleUserReply: "Contame más sobre lo que necesitás.",
  },
};

const ROUTE_OPTIONS_BY_STRATEGY_TYPE: Record<
  Exclude<ClarificationStrategyType, "context_missing_for_known_route">,
  ClarificationRouteOptionIntent[]
> = {
  generic_ambiguous: [
    "project_status_question",
    "risk_analysis",
    "decision_support",
    "communication_draft",
    "task_or_action_request",
    "closure_question",
  ],
  review_without_context: ["project_status_question", "risk_analysis", "recommendation_request", "decision_support", "governance_question"],
  follow_up_ambiguous: ["communication_draft", "task_or_action_request", "project_status_question", "risk_analysis"],
  concern_without_domain: ["risk_analysis", "project_status_question", "decision_support", "recommendation_request"],
  stalled_progress_ambiguous: [
    "project_status_question",
    "risk_analysis",
    "decision_support",
    "communication_draft",
    "task_or_action_request",
  ],
  communication_hint_ambiguous: ["communication_draft", "project_status_question", "decision_support"],
  task_hint_ambiguous: ["task_or_action_request", "project_status_question", "risk_analysis"],
  risk_hint_ambiguous: ["risk_analysis", "decision_support", "project_status_question"],
  status_hint_ambiguous: ["project_status_question", "risk_analysis", "recommendation_request"],
  decision_hint_ambiguous: ["decision_support", "recommendation_request", "risk_analysis"],
};

type ContextMissingRouteRule = { matches: (patterns: string[]) => boolean; intents: ClarificationRouteOptionIntent[] };

const CONTEXT_MISSING_ROUTE_BY_SIGNAL: ContextMissingRouteRule[] = [
  { matches: (p) => p.some((x) => x.includes("redactar_vago")), intents: ["communication_draft"] },
  { matches: (p) => p.some((x) => x.includes("crear_tarea_vaga")), intents: ["task_or_action_request"] },
  { matches: (p) => p.some((x) => x.includes("facturar_vago")), intents: ["billing_question"] },
  { matches: (p) => p.some((x) => x.includes("cerrar_vago")), intents: ["closure_question"] },
  { matches: (p) => p.some((x) => x.includes("escalar_vago")), intents: ["task_or_action_request", "governance_question"] },
];

function priorityForIndex(index: number): ClarificationRouteOption["priority"] {
  if (index === 0) return "high";
  if (index === 1) return "medium";
  return "low";
}

/**
 * Suggests which production-shaped routes this message could plausibly belong to, given its
 * detected strategy type. `context_missing_for_known_route` special-cases on the specific matched
 * signal (which domain verb fired) instead of using a fixed per-type list, since that category's
 * whole premise is "we already know the domain, just not the object/content."
 */
export function inferSuggestedRouteOptions(
  input: string,
  strategyType: ClarificationStrategyType,
  missingSlots: ClarificationMissingSlot[],
  context?: ClarificationAvailableContext,
): ClarificationRouteOption[] {
  let intents: ClarificationRouteOptionIntent[];

  if (strategyType === "context_missing_for_known_route") {
    const { matchedPatterns } = detectClarificationStrategyTypeWithDetail(input);
    const matched = CONTEXT_MISSING_ROUTE_BY_SIGNAL.find((rule) => rule.matches(matchedPatterns));
    intents = matched ? matched.intents : ["unsupported"];
  } else {
    intents = ROUTE_OPTIONS_BY_STRATEGY_TYPE[strategyType];
  }

  return intents.map((intent, index) => ({ ...ROUTE_OPTION_CATALOG[intent], priority: priorityForIndex(index) }));
}

// ─── Questions ────────────────────────────────────────────────────────────────────────

const QUESTION_TEXT_BY_SLOT: Record<ClarificationMissingSlot, { question: string; reason: string }> = {
  project: {
    question: "¿De qué proyecto o contexto estamos hablando?",
    reason: "No se identificó un proyecto conocido en el mensaje ni en el contexto disponible.",
  },
  intent: {
    question: "¿Querés que revise estado, riesgos, decisión, comunicación, tareas o cierre/facturación?",
    reason: "El mensaje es demasiado genérico para inferir qué tipo de ayuda se necesita.",
  },
  source_context: {
    question: "¿Qué contexto específico querés que revise?",
    reason: "El mensaje hace referencia a 'esto/eso' sin contexto adjunto ni mensajes previos.",
  },
  desired_output: {
    question: "¿Querés que lo convierta en correo, tarea, análisis de riesgo o recomendación?",
    reason: "No queda claro qué tipo de resultado esperás (análisis, correo, tarea, decisión o estado).",
  },
  urgency: {
    question: "¿Qué tan urgente es esto? ¿Hay una fecha límite?",
    reason: "Hay señales de bloqueo o preocupación pero no se indicó un plazo.",
  },
  owner: {
    question: "¿Quién debería quedar a cargo de esto?",
    reason: "Se pide seguimiento o una tarea, pero no se menciona un responsable.",
  },
  recipient: {
    question: "¿Para quién es esta comunicación?",
    reason: "Se sugiere comunicar algo pero no se menciona el destinatario.",
  },
  evidence: {
    question: "¿Ya existe evidencia o respaldo disponible para esto (acta, correo, aceptación)?",
    reason: "Se menciona cierre, facturación o una decisión sin evidencia de respaldo.",
  },
  decision_options: {
    question: "¿Cuáles son las opciones que estás considerando?",
    reason: "Se sugiere una decisión pendiente pero no se nombran las alternativas.",
  },
  action_authorization: {
    question: "¿Confirmás que avancemos con esto, o preferís que primero lo revise?",
    reason: "Hay un verbo de acción (mover/seguir/asignar/escalar) sin confirmación explícita.",
  },
  timeframe: {
    question: "¿Para cuándo necesitás esto resuelto?",
    reason: "No se indicó un plazo o fecha límite.",
  },
};

function priorityForQuestionIndex(index: number): ClarificationQuestion["priority"] {
  if (index === 0) return "high";
  if (index === 1) return "medium";
  return "low";
}

export type ClarificationQuestionSet = {
  primaryQuestion: ClarificationQuestion;
  secondaryQuestions: ClarificationQuestion[];
};

const DEFAULT_PRIMARY_QUESTION: ClarificationQuestion = {
  id: "cq-1",
  question: QUESTION_TEXT_BY_SLOT.project.question,
  slot: "project",
  priority: "high",
  reason: "No missing slot was detected explicitly; defaulting to asking for the project context.",
};

/**
 * Builds a primary clarifying question plus at most three secondary questions, ordered by slot
 * priority (project, intent, source_context, desired_output, then the case-specific slots). Never
 * asks about more than four slots total, per the sprint's "ask at most 1-3 key questions" rule.
 */
export function buildClarificationQuestions(
  input: string,
  strategyType: ClarificationStrategyType,
  missingSlots: ClarificationMissingSlot[],
  routeOptions: ClarificationRouteOption[],
  context?: ClarificationAvailableContext,
): ClarificationQuestionSet {
  const orderedSlots = sortSlots(missingSlots).slice(0, 4);

  const questions: ClarificationQuestion[] = orderedSlots.map((slot, index) => ({
    id: `cq-${index + 1}`,
    question: QUESTION_TEXT_BY_SLOT[slot].question,
    slot,
    priority: priorityForQuestionIndex(index),
    reason: QUESTION_TEXT_BY_SLOT[slot].reason,
  }));

  const primaryQuestion = questions[0] ?? DEFAULT_PRIMARY_QUESTION;
  const secondaryQuestions = questions.slice(1, 4);

  return { primaryQuestion, secondaryQuestions };
}

// ─── Ambiguity level ──────────────────────────────────────────────────────────────────

/**
 * high: project, intent, and source_context are all missing (no topic, no route, no referent).
 * medium: project or source_context is missing, but intent is not (a route signal exists).
 * low: neither project, intent, nor source_context is missing — the route is clear and only a
 * case-specific slot (owner, evidence, decision_options, ...) is outstanding.
 */
export function estimateAmbiguityLevel(
  input: string,
  missingSlots: ClarificationMissingSlot[],
  routeOptions: ClarificationRouteOption[],
  context?: ClarificationAvailableContext,
): ClarificationAmbiguityLevel {
  const has = (slot: ClarificationMissingSlot) => missingSlots.includes(slot);
  if (has("project") && has("intent") && has("source_context")) return "high";
  if ((has("project") || has("source_context")) && !has("intent")) return "medium";
  return "low";
}

// ─── Capability explanation ───────────────────────────────────────────────────────────

export type ClarificationResponseAnalysisExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  strategyTypes: ClarificationStrategyType[];
  detectionStrategy: string;
  missingSlotStrategy: string;
  routeOptionStrategy: string;
  ambiguityLevelRule: string;
  limitations: string[];
};

export function explainClarificationResponseAnalysis(): ClarificationResponseAnalysisExplain {
  return {
    capability: "playbook-engine-conversation-clarification-response-analyzer",
    purpose:
      "Pure, deterministic keyword-based analysis of already-ambiguous PM messages: detects a clarification " +
      "strategy type, infers which key slots (project, intent, source context, desired output, and case-specific " +
      "ones) are missing, and suggests plausible production-shaped routes — with no LLM call, no network access, " +
      "and no database access.",
    doesNot: [
      "Does not call fetch, a database, Supabase, Gmail, or an LLM.",
      "Does not import router/composer/handlers/gateway modules.",
      "Does not execute any action, create a task, or send a communication.",
      "Does not compete against the eight other production intent categories — it assumes the message is already a clarification candidate.",
      "Does not read the system clock or use randomness — every function is a pure function of its arguments.",
    ],
    strategyTypes: [
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
    detectionStrategy:
      "Ordered keyword/connector rules, most domain-specific first (an orphaned action verb like redactar/crear " +
      "tarea/facturar/cerrar/escalar with a vague pronoun object, then communication/task/risk/status/decision " +
      "hints, then stalled-progress and concern phrasing, then follow-up and review-without-context phrasing), " +
      "falling back to generic_ambiguous when nothing more specific matches.",
    missingSlotStrategy:
      "project/source_context are inferred dynamically from the caller-supplied context and whether the input " +
      "references a vague pronoun object ('esto'/'eso'); intent/desired_output/urgency/owner/recipient/" +
      "decision_options/evidence/action_authorization are inferred per strategyType from a fixed, documented table.",
    routeOptionStrategy:
      "Each strategyType maps to a fixed, priority-ordered list of plausible production-shaped routes, except " +
      "context_missing_for_known_route, which special-cases on the specific matched domain-verb signal instead.",
    ambiguityLevelRule:
      "high requires project + intent + source_context all missing; medium requires project or source_context " +
      "missing with intent present (a route signal exists); low is the default once the route is clear.",
    limitations: [
      "Keyword/connector matching, not full NLP — a phrase using different wording than the documented signals " +
        "falls through to the generic_ambiguous fallback.",
      "Missing-slot inference for case-specific slots (owner, recipient, evidence, decision_options) is a fixed " +
        "table per strategyType, not tailored to the exact wording of each message.",
      "Does not yet reuse conversational context beyond what the caller explicitly supplies via availableContext.",
    ],
  };
}
