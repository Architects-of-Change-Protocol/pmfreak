import type { ConversationalGatewayInput, HandlerResult } from "../types";
import { normalizeConversationText } from "../classifier/intentClassifier.rules";

type AdviceTopic = {
  match: RegExp;
  headline: string;
  body: string[];
  nextSteps: string[];
  /** Whether the advice's own next steps include a sensitive action (sending a communication,
   * escalating) that would itself require approval before being executed. */
  requiresApproval: boolean;
};

const ADVICE_TOPICS: AdviceTopic[] = [
  {
    match: /cliente no (?:responde|contesta)|client (?:is )?not responding/,
    headline: "Cuando el cliente deja de responder, el proyecto no se detiene — se gestiona.",
    body: [
      "Un cliente sin respuesta es un riesgo de cronograma, no una excusa para pausar el trabajo. Documenta cada intento de contacto: fecha, canal y qué necesitabas de él.",
    ],
    nextSteps: [
      "Envía un recordatorio formal con una fecha límite clara para responder.",
      "Si no hay respuesta para esa fecha, escala internamente (sponsor o cuenta) antes de que el atraso te lo reclamen a ti.",
      "Registra el bloqueo como un riesgo/dependencia abierta para que quede trazado.",
    ],
    requiresApproval: true,
  },
  {
    match: /pegado|atorado|estancado|no avanza|bloqueado|blocked|stuck/,
    headline: "Un proyecto 'pegado' casi siempre tiene una causa concreta: decisión pendiente, dependencia externa o aprobación sin dueño.",
    body: [
      "Antes de escalar, aísla exactamente qué lo detiene: ¿falta una decisión, una aprobación, un insumo del cliente, o un recurso interno?",
    ],
    nextSteps: [
      "Lista los bloqueadores concretos y quién es dueño de cada uno.",
      "Fija una fecha límite por bloqueador y comunícala.",
      "Si algún bloqueador no se resuelve a tiempo, escala con una recomendación clara, no solo con el problema.",
    ],
    requiresApproval: true,
  },
  {
    match: /cambio de alcance|scope creep|scope change/,
    headline: "Todo cambio de alcance debe pasar por control de cambios antes de ejecutarse.",
    body: ["Aceptar un cambio informalmente es lo que después se convierte en atraso y disputa de facturación."],
    nextSteps: [
      "Documenta el cambio solicitado y su impacto en cronograma/presupuesto.",
      "Pide aprobación formal del cliente y del sponsor interno antes de ejecutar.",
    ],
    requiresApproval: true,
  },
  {
    match: /equipo desmotivado|team is unmotivated|conflicto (?:en el|con el) equipo|team conflict/,
    headline: "Un equipo desalineado suele ser síntoma de prioridades poco claras, no de falta de esfuerzo.",
    body: ["Antes de asumir un problema de actitud, revisa si el equipo tiene claridad de prioridades, dueños y plazos."],
    nextSteps: [
      "Aclara prioridades y dueños en una reunión corta y específica.",
      "Si el conflicto persiste, ten conversaciones 1:1 para entender la causa real.",
    ],
    requiresApproval: false,
  },
];

const GENERIC_HEADLINE = "Puedo ayudarte con esto, aunque sea una pregunta abierta.";
const GENERIC_BODY = [
  "La gestión de proyectos efectiva se reduce casi siempre a lo mismo: evidencia clara, dueños definidos, plazos explícitos y comunicación oportuna.",
];
const GENERIC_NEXT_STEPS = [
  "Identifica qué evidencia concreta tienes y qué te falta.",
  "Define quién es dueño de resolver la situación y para cuándo.",
  "Comunica el estado real, no el que te gustaría reportar.",
];

/**
 * Answers open-ended PM questions without requiring any project context — by design, general PM
 * advice must never come back as "I don't have enough context." When no active project or
 * project evidence exists, this is the ceiling of what PMFreak can say; when it does exist, other
 * handlers (`project_status_handler`, etc.) layer project-specific analysis on top.
 */
export function handleGeneralPmAdvice(input: ConversationalGatewayInput): HandlerResult {
  const normalized = normalizeConversationText(input.message);
  const topic = ADVICE_TOPICS.find((candidate) => candidate.match.test(normalized));

  if (!topic) {
    const tooShort = normalized.split(/\s+/).filter(Boolean).length < 3;
    if (tooShort) {
      return {
        mode: "clarification_needed",
        headline: "Cuéntame un poco más para poder ayudarte bien.",
        body: ["¿Es sobre un proyecto específico, sobre el cliente, sobre el equipo, o sobre cierre/facturación?"],
        recommendedNextSteps: [],
        missingContext: [],
        requiresApproval: false,
        auditRelevant: false,
        confidence: 30,
        sourced: false,
      };
    }

    return {
      mode: "general_guidance",
      headline: GENERIC_HEADLINE,
      body: GENERIC_BODY,
      recommendedNextSteps: GENERIC_NEXT_STEPS,
      missingContext: [],
      requiresApproval: false,
      auditRelevant: false,
      confidence: 55,
      sourced: false,
    };
  }

  return {
    mode: "general_guidance",
    headline: topic.headline,
    body: topic.body,
    recommendedNextSteps: topic.nextSteps,
    missingContext: [],
    requiresApproval: topic.requiresApproval,
    auditRelevant: false,
    confidence: 75,
    sourced: false,
  };
}
