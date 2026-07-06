/**
 * Sprint 19R — Decision Support Candidate Handler: pure analyzer.
 *
 * Every export in this file is a pure, deterministic function over its arguments: no `fetch`, no
 * database/Supabase/Gmail access, no LLM call, no import from the router/composer/handlers/gateway,
 * and no side effects. Given the same input, every function here always returns the same output.
 *
 * This is a *candidate* analyzer, not a calibrated production classifier: its keyword/connector
 * rules are intentionally simple and are documented, not hidden, in `explainDecisionSupportAnalysis()`.
 * See `docs/conversational-brain-decision-support-candidate-handler.md` for the full design writeup
 * and `docs/conversational-brain-decision-support-clarification-architecture.md` (Sprint 18R) for the
 * policy this module is the first implementation step toward.
 */

import type {
  DecisionSupportConfidence,
  DecisionSupportContext,
  DecisionSupportDecisionType,
  DecisionSupportEvidenceNeed,
  DecisionSupportOption,
  DecisionSupportRisk,
  DecisionSupportTradeoff,
} from "./decisionSupportCandidateTypes";

// ─── Normalization ───────────────────────────────────────────────────────────────────

/**
 * Strips accents/diacritics and inverted punctuation, lowercases, and collapses whitespace.
 * Stable and deterministic: the same input always normalizes to the same output.
 */
export function normalizeDecisionSupportInput(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿¡]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Decision type detection ─────────────────────────────────────────────────────────

type DecisionTypeSignalCheck = { name: string; test: (norm: string) => boolean };

type DecisionTypeRule = {
  type: DecisionSupportDecisionType;
  /** At least one of these must be true for the rule to fire. */
  signals: DecisionTypeSignalCheck[];
  /** Additional guard that must also hold (e.g. "and not vendor-scoped") — defaults to always true. */
  guard?: (norm: string) => boolean;
};

const w = (word: string) => new RegExp(`\\b${word}\\b`);

const BILL_OR_WAIT_RULE: DecisionTypeRule = {
  type: "bill_or_wait",
  signals: [
    { name: "facturar", test: (n) => /\bfactur(ar|amos|a)\b/.test(n) },
    { name: "cobrar", test: (n) => /\bcobr(ar|amos|o)\b/.test(n) },
  ],
  guard: (n) =>
    /\bfactur(ar|amos|a)\b/.test(n) || /\bcobr(ar|amos|o)\b/.test(n)
      ? /\besperar?\b|\besperamos\b|\brecepcion\b|\bacept(ar|acion)\b|\bevidencia\b/.test(n) ||
        /\bya\b|\bahora\b/.test(n)
      : false,
};

const CLOSE_OR_CONTINUE_RULE: DecisionTypeRule = {
  type: "close_or_continue",
  signals: [
    { name: "cerrar", test: (n) => /\bcerrar\b|\bcerramos\b|\bcierre\b/.test(n) },
  ],
};

const ESCALATE_OR_WAIT_RULE: DecisionTypeRule = {
  type: "escalate_or_wait",
  signals: [
    { name: "escalar", test: (n) => /\bescalar\b|\bescalamos\b|\bescalo\b/.test(n) },
    {
      name: "presionar_no_proveedor_con_espera",
      test: (n) =>
        /\bpresion(ar|amos)\b/.test(n) &&
        !/\bproveedor\b/.test(n) &&
        (/\besperar?\b|\besperamos\b|\botro dia\b|\brespuesta\b/.test(n)),
    },
  ],
};

const ACCEPT_OR_MITIGATE_RISK_RULE: DecisionTypeRule = {
  type: "accept_or_mitigate_risk",
  signals: [{ name: "riesgo_y_postura", test: (n) => /\briesgo(s)?\b/.test(n) }],
  guard: (n) =>
    /\briesgo(s)?\b/.test(n) &&
    (/\bacept(ar|amos|a)\b|\basumir\b|\basumimos\b|\bmitigar(lo)?\b|\bmitigacion\b|\breducir\b|\bseguir\b|\bcontinuar\b/.test(
      n,
    )),
};

const CHANGE_VENDOR_OR_CONTINUE_RULE: DecisionTypeRule = {
  type: "change_vendor_or_continue",
  signals: [{ name: "proveedor_y_postura", test: (n) => /\bproveedor(es)?\b/.test(n) }],
  guard: (n) =>
    /\bproveedor(es)?\b/.test(n) &&
    (/\bcambiar\b|\bcambiamos\b|\bpresion(ar|amos)\b|\bseguimos\b|\bseguir\b/.test(n)),
};

const APPROVE_OR_REQUEST_EVIDENCE_RULE: DecisionTypeRule = {
  type: "approve_or_request_evidence",
  signals: [
    { name: "aprobar", test: (n) => /\baprob(ar|amos|acion)\b/.test(n) },
    {
      name: "evidencia_necesaria",
      test: (n) =>
        /\bevidencia\b|\bjustificacion\b|\brespaldo\b/.test(n) &&
        /\bnecesito\b|\bnecesitamos\b|\bpedimos\b|\bsolicit(ar|amos)\b/.test(n),
    },
  ],
};

const IDENTIFY_MISSING_DECISION_RULE: DecisionTypeRule = {
  type: "identify_missing_decision",
  signals: [
    { name: "decision_falta", test: (n) => /\bdecision(es)?\b/.test(n) && /\bfalta(ndo)?\b/.test(n) },
    { name: "decision_bloqueando", test: (n) => /\bdecision(es)?\b/.test(n) && /\bbloque/.test(n) },
    { name: "quien_decide", test: (n) => /\bquien\b/.test(n) && /\bdecid/.test(n) },
    { name: "decidirse", test: (n) => /\bdecidirse\b/.test(n) },
  ],
};

const PRIORITIZE_NEXT_STEP_RULE: DecisionTypeRule = {
  type: "prioritize_next_step",
  signals: [
    { name: "hago_primero", test: (n) => /\bhago primero\b|\bque hago primero\b/.test(n) },
    { name: "siguiente_paso", test: (n) => /\bsiguiente paso\b/.test(n) },
    { name: "priorizo", test: (n) => /\bque priorizo\b|\bdeberia priorizar\b|\bdebo priorizar\b|\bpriorizar ahora\b/.test(n) },
    {
      name: "camino_tomar",
      test: (n) => /\bcamino\b/.test(n) && /\btomar\b/.test(n) && !/\brecomiend/.test(n),
    },
  ],
};

const CHOOSE_BETWEEN_OPTIONS_RULE: DecisionTypeRule = {
  type: "choose_between_options",
  signals: [
    { name: "entre_y", test: (n) => /\bentre\b.*\by\b/.test(n) },
    { name: "vs_versus", test: (n) => /\bvs\.?\b|\bversus\b/.test(n) },
    { name: "opcion_a_opcion_b", test: (n) => /\bopci[o]n\s*a\b/.test(n) && /\bopci[o]n\s*b\b/.test(n) },
    { name: "letra_o_letra", test: (n) => /\b[a-z]\s+o\s+[a-z]\b/.test(n) },
    { name: "conector_o_generico", test: (n) => /\s+o\s+/.test(n) },
  ],
};

/** Ordered from most to least specific — the first matching rule wins. */
const DECISION_TYPE_RULES: DecisionTypeRule[] = [
  BILL_OR_WAIT_RULE,
  CLOSE_OR_CONTINUE_RULE,
  ESCALATE_OR_WAIT_RULE,
  ACCEPT_OR_MITIGATE_RISK_RULE,
  CHANGE_VENDOR_OR_CONTINUE_RULE,
  APPROVE_OR_REQUEST_EVIDENCE_RULE,
  IDENTIFY_MISSING_DECISION_RULE,
  PRIORITIZE_NEXT_STEP_RULE,
  CHOOSE_BETWEEN_OPTIONS_RULE,
];

export type DecisionTypeDetectionDetail = {
  decisionType: DecisionSupportDecisionType;
  matchedPatterns: string[];
};

function evaluateRule(rule: DecisionTypeRule, norm: string): string[] | null {
  const guardOk = rule.guard ? rule.guard(norm) : true;
  if (!guardOk) return null;
  const firedSignals = rule.signals.filter((s) => s.test(norm)).map((s) => `${rule.type}:${s.name}`);
  if (rule.guard && firedSignals.length === 0) {
    // The guard alone decided this rule fires (e.g. accept_or_mitigate_risk's single combined signal).
    return [`${rule.type}:guard`];
  }
  return firedSignals.length > 0 ? firedSignals : null;
}

/**
 * Detects which of the ten candidate decision types a message belongs to. Deterministic keyword
 * and connector matching, evaluated in priority order (most specific decision-domain vocabulary
 * first); `general_decision_support` is the safe fallback when no more specific rule fires.
 */
export function detectDecisionTypeWithDetail(input: string): DecisionTypeDetectionDetail {
  const norm = normalizeDecisionSupportInput(input);
  for (const rule of DECISION_TYPE_RULES) {
    const matched = evaluateRule(rule, norm);
    if (matched) return { decisionType: rule.type, matchedPatterns: matched };
  }
  return { decisionType: "general_decision_support", matchedPatterns: ["general_decision_support:fallback_no_specific_pattern"] };
}

export function detectDecisionType(input: string): DecisionSupportDecisionType {
  return detectDecisionTypeWithDetail(input).decisionType;
}

// ─── Option extraction ───────────────────────────────────────────────────────────────

let optionCounter = 0;
function nextOptionId(prefix: string): string {
  optionCounter += 1;
  return `${prefix}-${optionCounter}`;
}

function cleanOptionLabel(raw: string): string {
  const stripped = raw
    .replace(/^(y|o|,|;)\s+/i, "")
    .replace(/[.,;:?!¿¡]+$/g, "")
    .replace(/^(deberiamos|deberíamos|conviene|convendria|convendría|es mejor|seria mejor|sería mejor|nos conviene|prefieres|vamos con|optamos por|seguimos con|usamos|elegimos|cuál|cual)\s+/i, "")
    .trim();
  const cleaned = stripped.length > 0 ? stripped : raw.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Tries to split an input into two named-option labels using explicit structural connectors. */
function tryExtractNamedOptionLabels(input: string): [string, string] | null {
  const entreMatch = input.match(/\bentre\s+(.+?)\s+y\s+(.+?)([.?!]|$)/i);
  if (entreMatch) return [cleanOptionLabel(entreMatch[1]), cleanOptionLabel(entreMatch[2])];

  const opcionAB = input.match(/opci[oó]n\s*a\b(.*?)(?:\bopci[oó]n\s*b\b)(.*)/i);
  if (opcionAB) return ["Opción A", "Opción B"];

  const vsMatch = input.match(/(.+?)\s+(?:vs\.?|versus)\s+(.+?)([.?!]|$)/i);
  if (vsMatch) return [cleanOptionLabel(vsMatch[1]), cleanOptionLabel(vsMatch[2])];

  const oMatch = input.match(/(.+?)\s+\bo\b\s+(.+?)([.?!]|$)/i);
  if (oMatch) return [cleanOptionLabel(oMatch[1]), cleanOptionLabel(oMatch[2])];

  return null;
}

function makeOption(
  id: string,
  label: string,
  detectedFromInput: boolean,
  overrides: Partial<DecisionSupportOption> = {},
): DecisionSupportOption {
  return {
    id,
    label,
    description: overrides.description ?? `Camino candidato: ${label}.`,
    detectedFromInput,
    pros: overrides.pros ?? [],
    cons: overrides.cons ?? [],
    risks: overrides.risks ?? [],
    evidenceNeeded: overrides.evidenceNeeded ?? [],
    likelyImpact: overrides.likelyImpact ?? "unknown",
    reversibility: overrides.reversibility ?? "unknown",
  };
}

const CANNED_OPTIONS_BY_DECISION_TYPE: Partial<
  Record<DecisionSupportDecisionType, Array<{ label: string; impact: DecisionSupportOption["likelyImpact"]; reversibility: DecisionSupportOption["reversibility"] }>>
> = {
  escalate_or_wait: [
    { label: "Escalar", impact: "medium", reversibility: "moderate" },
    { label: "Esperar", impact: "low", reversibility: "easy" },
  ],
  bill_or_wait: [
    { label: "Facturar ahora", impact: "high", reversibility: "hard" },
    { label: "Esperar recepción formal", impact: "medium", reversibility: "easy" },
  ],
  accept_or_mitigate_risk: [
    { label: "Aceptar riesgo", impact: "high", reversibility: "hard" },
    { label: "Mitigar riesgo", impact: "medium", reversibility: "moderate" },
  ],
  change_vendor_or_continue: [
    { label: "Cambiar proveedor", impact: "high", reversibility: "hard" },
    { label: "Presionar al proveedor actual", impact: "medium", reversibility: "easy" },
  ],
  close_or_continue: [
    { label: "Cerrar ahora", impact: "high", reversibility: "hard" },
    { label: "Continuar y reunir más evidencia", impact: "medium", reversibility: "easy" },
  ],
  approve_or_request_evidence: [
    { label: "Aprobar con la evidencia actual", impact: "medium", reversibility: "moderate" },
    { label: "Solicitar evidencia adicional", impact: "low", reversibility: "easy" },
  ],
};

/**
 * Extracts named decision options from the input. Uses canned, decision-type-specific option pairs
 * for the six binary decision types the sprint spec names explicitly; otherwise tries to split the
 * text on explicit connectors ("entre X y Y", "vs", "versus", " o "); falls back to a single generic
 * placeholder option when no structural signal is present. Always returns at least one option.
 */
export function extractDecisionOptions(input: string, context?: DecisionSupportContext): DecisionSupportOption[] {
  const decisionType = detectDecisionType(input);
  const canned = CANNED_OPTIONS_BY_DECISION_TYPE[decisionType];

  if (canned) {
    return canned.map((c) =>
      makeOption(nextOptionId(decisionType), c.label, true, { likelyImpact: c.impact, reversibility: c.reversibility }),
    );
  }

  if (decisionType === "choose_between_options" || decisionType === "general_decision_support") {
    const extracted = tryExtractNamedOptionLabels(input);
    if (extracted) {
      return [
        makeOption(nextOptionId(decisionType), extracted[0], true),
        makeOption(nextOptionId(decisionType), extracted[1], true),
      ];
    }
    if (decisionType === "choose_between_options") {
      return [
        makeOption(nextOptionId(decisionType), "Opción A", false),
        makeOption(nextOptionId(decisionType), "Opción B", false),
      ];
    }
    return [
      makeOption(nextOptionId(decisionType), "Camino a definir con más contexto", false, {
        description: "No se nombraron opciones concretas ni contexto suficiente en el input.",
      }),
    ];
  }

  if (decisionType === "prioritize_next_step") {
    return [
      makeOption(nextOptionId(decisionType), "Definir y ejecutar el siguiente paso prioritario", true, {
        description: "Identificar cuál pendiente tiene mayor urgencia o impacto y actuar sobre ese primero.",
      }),
    ];
  }

  // identify_missing_decision
  return [
    makeOption(nextOptionId(decisionType), "Identificar y asignar la decisión pendiente", true, {
      description: "Nombrar explícitamente qué decisión falta y quién debe tomarla.",
    }),
  ];
}

// ─── Tradeoffs ────────────────────────────────────────────────────────────────────────

const TRADEOFFS_BY_DECISION_TYPE: Record<DecisionSupportDecisionType, Array<{ dimension: string; summary: string; riskLevel: DecisionSupportTradeoff["riskLevel"] }>> = {
  bill_or_wait: [
    {
      dimension: "cashflow vs compliance",
      summary: "Facturar ahora mejora el flujo de caja pero puede exponer a objeciones si la evidencia formal aún no está cerrada.",
      riskLevel: "high",
    },
    {
      dimension: "speed vs evidence quality",
      summary: "Esperar la recepción formal reduce el riesgo de disputa pero retrasa el cobro.",
      riskLevel: "medium",
    },
  ],
  escalate_or_wait: [
    {
      dimension: "escalation pressure vs relationship health",
      summary: "Escalar puede desbloquear la decisión rápido pero tensiona la relación con el stakeholder o cliente.",
      riskLevel: "medium",
    },
    {
      dimension: "speed vs evidence quality",
      summary: "Esperar preserva la relación pero prolonga el bloqueo si no hay una fecha límite clara.",
      riskLevel: "medium",
    },
  ],
  close_or_continue: [
    {
      dimension: "closure speed vs audit defensibility",
      summary: "Cerrar ya acelera el cierre administrativo pero puede dejar observaciones sin resolver que luego generen disputa.",
      riskLevel: "high",
    },
    {
      dimension: "speed vs evidence quality",
      summary: "Pedir más evidencia antes de cerrar fortalece la defensa del cierre pero retrasa la facturación asociada.",
      riskLevel: "medium",
    },
  ],
  accept_or_mitigate_risk: [
    {
      dimension: "risk acceptance vs mitigation cost",
      summary: "Aceptar el riesgo evita costo y esfuerzo inmediato pero deja expuesta la entrega si el riesgo se materializa.",
      riskLevel: "high",
    },
    {
      dimension: "speed vs evidence quality",
      summary: "Mitigar reduce la exposición pero consume tiempo y recursos que podrían no estar presupuestados.",
      riskLevel: "medium",
    },
  ],
  change_vendor_or_continue: [
    {
      dimension: "delivery continuity vs vendor switch cost",
      summary: "Cambiar de proveedor puede resolver el problema de raíz pero introduce costo de transición y riesgo de continuidad.",
      riskLevel: "high",
    },
    {
      dimension: "escalation pressure vs relationship health",
      summary: "Presionar al proveedor actual preserva continuidad pero depende de que el proveedor realmente mejore.",
      riskLevel: "medium",
    },
  ],
  approve_or_request_evidence: [
    {
      dimension: "speed vs evidence quality",
      summary: "Aprobar ahora acelera el avance pero puede dejar la decisión sin respaldo suficiente si se audita después.",
      riskLevel: "medium",
    },
    {
      dimension: "closure speed vs audit defensibility",
      summary: "Pedir más evidencia fortalece la trazabilidad pero retrasa la aprobación.",
      riskLevel: "medium",
    },
  ],
  choose_between_options: [
    {
      dimension: "stakeholder alignment vs execution speed",
      summary:
        "Elegir la opción con más consenso puede tomar más tiempo en acordarse pero reduce fricción posterior; elegir la más rápida arriesga alineación con stakeholders.",
      riskLevel: "medium",
    },
  ],
  prioritize_next_step: [
    {
      dimension: "stakeholder alignment vs execution speed",
      summary: "Priorizar el paso más urgente acelera el desbloqueo pero puede dejar otros compromisos esperando.",
      riskLevel: "low",
    },
  ],
  identify_missing_decision: [
    {
      dimension: "closure speed vs audit defensibility",
      summary:
        "Nombrar quién decide desbloquea el avance, pero si se decide sin el owner correcto puede requerir revertir la decisión después.",
      riskLevel: "medium",
    },
  ],
  general_decision_support: [
    {
      dimension: "stakeholder alignment vs execution speed",
      summary: "Sin opciones concretas nombradas, cualquier camino elegido debería balancear alineación con stakeholders y velocidad de ejecución.",
      riskLevel: "unknown",
    },
  ],
};

/** Deterministic tradeoffs per decisionType — same decisionType always yields the same tradeoff set. */
export function identifyDecisionTradeoffs(
  input: string,
  options: DecisionSupportOption[],
  context?: DecisionSupportContext,
): DecisionSupportTradeoff[] {
  const decisionType = detectDecisionType(input);
  const templates = TRADEOFFS_BY_DECISION_TYPE[decisionType];
  return templates.map((t) => ({
    dimension: t.dimension,
    optionA: options[0]?.label,
    optionB: options[1]?.label,
    summary: t.summary,
    riskLevel: t.riskLevel,
  }));
}

// ─── Risks ───────────────────────────────────────────────────────────────────────────

const RISKS_BY_DECISION_TYPE: Record<DecisionSupportDecisionType, Array<{ description: string; severity: DecisionSupportRisk["severity"]; mitigation?: string }>> = {
  bill_or_wait: [
    {
      description: "Retraso de facturación si se espera demasiado a la recepción formal.",
      severity: "medium",
      mitigation: "Definir una fecha límite clara para decidir.",
    },
    {
      description: "Decisión sin evidencia suficiente si se factura sin respaldo documental.",
      severity: "high",
      mitigation: "Confirmar acta de recepción o aceptación escrita antes de facturar.",
    },
  ],
  close_or_continue: [
    { description: "Pérdida de trazabilidad si se cierra sin documentar observaciones pendientes.", severity: "high" },
    { description: "Retraso de facturación asociado si el cierre se pospone indefinidamente.", severity: "medium" },
  ],
  escalate_or_wait: [
    { description: "Deterioro de relación si se escala prematuramente.", severity: "medium" },
    { description: "Pérdida de trazabilidad si se espera sin dejar registro del seguimiento.", severity: "medium" },
  ],
  accept_or_mitigate_risk: [
    {
      description: "Ejecución sin aprobación si se acepta el riesgo sin informar al stakeholder correspondiente.",
      severity: "high",
    },
    { description: "Costo de cambio si luego se decide mitigar tras haber avanzado aceptando el riesgo.", severity: "medium" },
  ],
  change_vendor_or_continue: [
    { description: "Costo de cambio si se cambia de proveedor a mitad de la entrega.", severity: "high" },
    { description: "Dependencia externa persistente si se sigue con el proveedor actual sin mejoras concretas.", severity: "medium" },
  ],
  approve_or_request_evidence: [
    { description: "Ejecución sin aprobación si se avanza antes de tener la evidencia necesaria.", severity: "high" },
    { description: "Decisión sin evidencia suficiente si se aprueba solo por presión de tiempo.", severity: "medium" },
  ],
  choose_between_options: [
    { description: "Rechazo del cliente si la opción elegida no fue validada con el stakeholder correcto.", severity: "medium" },
    { description: "Scope creep si la opción elegida abre alcance no contemplado.", severity: "medium" },
  ],
  prioritize_next_step: [
    { description: "Pérdida de trazabilidad si se avanza sin registrar por qué se priorizó este paso.", severity: "low" },
  ],
  identify_missing_decision: [
    { description: "Ejecución sin aprobación si el equipo avanza mientras la decisión sigue sin dueño.", severity: "high" },
  ],
  general_decision_support: [
    { description: "Decisión sin evidencia suficiente dado que no se nombraron opciones ni contexto concreto.", severity: "medium" },
  ],
};

/** Deterministic risks per decisionType. */
export function identifyDecisionRisks(
  input: string,
  options: DecisionSupportOption[],
  context?: DecisionSupportContext,
): DecisionSupportRisk[] {
  const decisionType = detectDecisionType(input);
  const templates = RISKS_BY_DECISION_TYPE[decisionType];
  return templates.map((t) => ({
    description: t.description,
    severity: t.severity,
    mitigation: t.mitigation,
    relatedOptionId: options[0]?.id,
  }));
}

// ─── Evidence needs ───────────────────────────────────────────────────────────────────

const EVIDENCE_BY_DECISION_TYPE: Record<DecisionSupportDecisionType, Array<{ description: string; reason: string; priority: DecisionSupportEvidenceNeed["priority"] }>> = {
  bill_or_wait: [
    { description: "Acta de recepción", reason: "Confirma que el cliente recibió el entregable formalmente.", priority: "high" },
    { description: "Aceptación escrita", reason: "Respalda que el cliente aceptó el resultado antes de facturar.", priority: "high" },
    { description: "Evidencia de entrega", reason: "Documenta qué se entregó y cuándo.", priority: "medium" },
    { description: "Contrato / condición de facturación", reason: "Define si el hito habilita facturar ya.", priority: "medium" },
    { description: "Observaciones pendientes", reason: "Determina si hay bloqueos abiertos antes de cobrar.", priority: "medium" },
  ],
  close_or_continue: [
    { description: "Lista de pendientes", reason: "Confirma si queda algo abierto antes de cerrar.", priority: "high" },
    { description: "Aceptación del cliente", reason: "Valida que el cliente esté de acuerdo con el cierre.", priority: "high" },
    { description: "Evidencia de cierre técnico", reason: "Respalda que el trabajo técnico está completo.", priority: "medium" },
    { description: "Criterios de cierre", reason: "Define qué condiciones deben cumplirse para cerrar formalmente.", priority: "medium" },
  ],
  escalate_or_wait: [
    { description: "Historial de seguimientos", reason: "Muestra cuántas veces ya se intentó desbloquear sin escalar.", priority: "high" },
    { description: "SLA / plazo vencido", reason: "Determina si ya se superó el tiempo razonable de espera.", priority: "high" },
    { description: "Impacto del bloqueo", reason: "Mide qué tan urgente es desbloquear la decisión.", priority: "medium" },
    { description: "Stakeholder owner", reason: "Identifica a quién corresponde escalar la decisión.", priority: "medium" },
  ],
  accept_or_mitigate_risk: [
    { description: "Severidad", reason: "Determina cuán grave sería que el riesgo se materialice.", priority: "high" },
    { description: "Probabilidad", reason: "Determina cuán probable es que el riesgo ocurra.", priority: "high" },
    { description: "Impacto", reason: "Determina el efecto del riesgo sobre la entrega si ocurre.", priority: "medium" },
    { description: "Mitigaciones disponibles", reason: "Lista qué opciones de mitigación existen y su costo.", priority: "medium" },
    { description: "Aprobación requerida", reason: "Confirma si aceptar el riesgo necesita sign-off explícito.", priority: "high" },
  ],
  change_vendor_or_continue: [
    { description: "Desempeño del proveedor", reason: "Evalúa si el proveedor actual realmente no está cumpliendo.", priority: "high" },
    { description: "Alternativas disponibles", reason: "Confirma si existe un proveedor alternativo viable.", priority: "medium" },
    { description: "Impacto en cronograma", reason: "Mide el efecto de un cambio de proveedor sobre las fechas.", priority: "high" },
    { description: "Impacto contractual", reason: "Determina penalidades o compromisos ligados al proveedor actual.", priority: "medium" },
  ],
  approve_or_request_evidence: [
    { description: "Evidencia actual", reason: "Determina qué respaldo ya existe para esta decisión.", priority: "high" },
    { description: "Evidencia faltante", reason: "Identifica qué falta para poder aprobar con confianza.", priority: "high" },
    { description: "Criterio de aprobación", reason: "Define qué estándar debe cumplir la evidencia para aprobar.", priority: "medium" },
    { description: "Responsable aprobador", reason: "Identifica quién debe dar la aprobación final.", priority: "medium" },
  ],
  choose_between_options: [
    { description: "Criterios de decisión priorizados", reason: "Sin criterios explícitos, comparar opciones es subjetivo.", priority: "high" },
    { description: "Impacto de cada opción", reason: "Determina qué tan reversible y riesgosa es cada alternativa.", priority: "medium" },
    { description: "Preferencia de los stakeholders involucrados", reason: "Evita elegir una opción que luego se rechace.", priority: "medium" },
  ],
  prioritize_next_step: [
    { description: "Urgencia relativa de cada pendiente", reason: "Sin esto no se puede establecer un orden confiable.", priority: "high" },
    { description: "Dependencias entre las tareas pendientes", reason: "Evita priorizar un paso que depende de otro sin resolver.", priority: "medium" },
  ],
  identify_missing_decision: [
    { description: "Dueño de la decisión pendiente", reason: "Sin un owner claro la decisión seguirá bloqueada.", priority: "high" },
    { description: "Fecha límite para decidir", reason: "Da urgencia concreta a una decisión que hoy no la tiene.", priority: "medium" },
  ],
  general_decision_support: [
    { description: "Contexto adicional del proyecto", reason: "El input no trae suficiente contexto para recomendar con confianza.", priority: "high" },
    { description: "Opciones concretas a evaluar", reason: "No se nombraron alternativas específicas para comparar.", priority: "high" },
  ],
};

/** Deterministic evidence needs per decisionType. */
export function identifyEvidenceNeeds(
  input: string,
  decisionType: DecisionSupportDecisionType,
  options: DecisionSupportOption[],
  context?: DecisionSupportContext,
): DecisionSupportEvidenceNeed[] {
  return EVIDENCE_BY_DECISION_TYPE[decisionType].map((t) => ({ ...t }));
}

// ─── Decision statement ───────────────────────────────────────────────────────────────

/** Builds a short, human-readable statement of the decision to resolve. Always non-empty. */
export function buildDecisionStatement(
  input: string,
  decisionType: DecisionSupportDecisionType,
  options: DecisionSupportOption[],
): string {
  const labels = options.map((o) => o.label);
  switch (decisionType) {
    case "bill_or_wait":
      return `Definir si conviene ${labels[0] ?? "facturar ahora"} o ${labels[1] ?? "esperar recepción formal"}.`;
    case "escalate_or_wait":
      return `Definir si conviene ${labels[0] ?? "escalar"} o ${labels[1] ?? "esperar"}.`;
    case "close_or_continue":
      return `Definir si conviene ${labels[0] ?? "cerrar ahora"} o ${labels[1] ?? "continuar y reunir más evidencia"}.`;
    case "accept_or_mitigate_risk":
      return `Definir si conviene ${labels[0] ?? "aceptar el riesgo"} o ${labels[1] ?? "mitigarlo"}.`;
    case "change_vendor_or_continue":
      return `Definir si conviene ${labels[0] ?? "cambiar de proveedor"} o ${labels[1] ?? "presionar al proveedor actual"}.`;
    case "approve_or_request_evidence":
      return `Definir si conviene ${labels[0] ?? "aprobar"} o ${labels[1] ?? "solicitar más evidencia"}.`;
    case "choose_between_options":
      return labels.length >= 2
        ? `Definir cuál opción conviene: ${labels[0]} o ${labels[1]}.`
        : "Definir cuál opción conviene tomar.";
    case "prioritize_next_step":
      return "Definir cuál es el siguiente paso a priorizar.";
    case "identify_missing_decision":
      return "Identificar qué decisión pendiente está bloqueando el avance y quién debe tomarla.";
    case "general_decision_support":
    default:
      return "Definir cuál camino conviene seguir para esta decisión.";
  }
}

// ─── Confidence estimation ────────────────────────────────────────────────────────────

function contextHasSignal(context?: DecisionSupportContext): boolean {
  if (!context) return false;
  return Object.values(context).some((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
}

/**
 * high: two or more input-detected options AND some context/evidence signal.
 * medium: exactly one of those two signals is present.
 * low: neither signal is present (ambiguous decision, or missing options/context).
 */
export function estimateDecisionConfidence(
  input: string,
  options: DecisionSupportOption[],
  context?: DecisionSupportContext,
): DecisionSupportConfidence {
  const detectedOptionCount = options.filter((o) => o.detectedFromInput).length;
  const hasTwoOrMoreClearOptions = detectedOptionCount >= 2;
  const hasContext = contextHasSignal(context);

  if (hasTwoOrMoreClearOptions && hasContext) return "high";
  if (hasTwoOrMoreClearOptions || hasContext) return "medium";
  return "low";
}

// ─── Capability explanation ───────────────────────────────────────────────────────────

export type DecisionSupportAnalysisExplain = {
  capability: string;
  purpose: string;
  doesNot: string[];
  decisionTypes: DecisionSupportDecisionType[];
  detectionStrategy: string;
  optionExtractionStrategy: string;
  confidenceRule: string;
  limitations: string[];
};

export function explainDecisionSupportAnalysis(): DecisionSupportAnalysisExplain {
  return {
    capability: "playbook-engine-conversation-decision-support-analyzer",
    purpose:
      "Pure, deterministic keyword/connector-based analysis of decision-shaped PM messages: detects a decision " +
      "type, extracts or constructs options, and generates deterministic tradeoffs/risks/evidence-needs per type — " +
      "with no LLM call, no network access, and no database access.",
    doesNot: [
      "Does not call fetch, a database, Supabase, Gmail, or an LLM.",
      "Does not import router/composer/handlers/gateway modules.",
      "Does not execute any action, create a task, or send a communication.",
      "Does not read the system clock or use randomness — every function is a pure function of its arguments.",
    ],
    decisionTypes: [
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
    detectionStrategy:
      "Ordered keyword/connector rules, most decision-domain-specific first (billing, closure, escalation, risk, " +
      "vendor, evidence, missing-decision, prioritization, then structural option connectors), falling back to " +
      "general_decision_support when nothing more specific matches.",
    optionExtractionStrategy:
      "Six binary decision types use canned, decision-type-specific option pairs (e.g. escalate_or_wait -> " +
      "Escalar/Esperar); choose_between_options and general_decision_support try to split the text on explicit " +
      "connectors (entre...y, vs, versus, ' o '); prioritize_next_step and identify_missing_decision return a " +
      "single generic action option; every path always returns at least one option.",
    confidenceRule:
      "high requires 2+ input-detected options AND some availableContext signal; medium requires exactly one of " +
      "those two; low requires neither (ambiguous decision or missing options/context).",
    limitations: [
      "Keyword/connector matching, not full NLP — extracted option labels may include surrounding words for " +
        "unusual phrasing.",
      "Tradeoffs/risks/evidence needs are deterministic per decisionType, not tailored to the specific wording of " +
        "each message.",
      "Does not reuse the DecisionDraft data from operational-intelligence-engine.ts yet (Sprint 18R's documented " +
        "future-handler requirement) — see the candidate handler doc's 'What this does NOT solve yet' section.",
    ],
  };
}
