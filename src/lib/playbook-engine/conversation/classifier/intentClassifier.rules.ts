import type { ConversationIntent } from "../types";

/**
 * Rule-based intent classification patterns. Every pattern is matched against a normalized
 * (lowercased, accent-stripped) version of the message, so `está`/`esta`, `qué`/`que`, etc. are
 * equivalent — this is what lets the same pattern list cover both accented and informal Spanish
 * typing without duplicating every rule. Patterns are intentionally narrow/specific per intent
 * so overlapping vocabulary (e.g. "recomiendas" vs "recomendaste") never collides.
 */
export type IntentPattern = {
  pattern: RegExp;
  weight: number;
  label: string;
};

export const INTENT_PATTERNS: Record<Exclude<ConversationIntent, "clarification" | "unknown">, IntentPattern[]> = {
  general_pm_advice: [
    { pattern: /que hago si/, weight: 45, label: "que hago si" },
    { pattern: /que deberia hacer/, weight: 40, label: "que deberia hacer" },
    { pattern: /como (?:manejo|lidio|debo manejar|debo lidiar)/, weight: 40, label: "como manejo/lidio" },
    { pattern: /cliente no (?:responde|contesta)/, weight: 35, label: "cliente no responde" },
    { pattern: /(?:dame un |algun )?consejo/, weight: 30, label: "consejo" },
    { pattern: /what should i do if/, weight: 45, label: "what should i do if" },
    { pattern: /how (?:do i|should i) (?:handle|deal with)/, weight: 40, label: "how do i handle" },
    { pattern: /client (?:is not|isn't|is)? ?not responding/, weight: 35, label: "client not responding" },
  ],
  project_status_question: [
    { pattern: /que esta bloqueando/, weight: 50, label: "que esta bloqueando" },
    { pattern: /(?:esta|esta el proyecto)? ?bloqueado/, weight: 35, label: "bloqueado" },
    { pattern: /(?:esta )?pegado/, weight: 35, label: "pegado" },
    { pattern: /atorado|estancado|no avanza/, weight: 35, label: "atorado/estancado/no avanza" },
    { pattern: /nadie (?:responde|contesta)/, weight: 35, label: "nadie responde" },
    { pattern: /(?:como va|estado d?e?l? proyecto|que esta pasando con el proyecto)/, weight: 35, label: "estado del proyecto" },
    { pattern: /what(?:'s| is) blocking/, weight: 45, label: "what's blocking" },
    { pattern: /project status/, weight: 30, label: "project status" },
    // Sprint 12R calibration — generic-but-scoped project-status vocabulary the classifier was
    // missing (golden corpus mismatches ps-02/03/04/05/06/10/11). Kept narrow/testable rather than
    // bare single words wherever a bare word risked colliding with another category (see the
    // `estado de` lookahead below, which excludes "estado de esta/la tarea" so it doesn't hijack
    // task_action phrases like "actualiza el estado de esta tarea").
    { pattern: /estado de(?! (?:esta|la|una|dicha) tarea)/, weight: 28, label: "estado de <referencia>" },
    { pattern: /avance tenemos|avance del proyecto/, weight: 30, label: "avance (tenemos/del proyecto)" },
    { pattern: /\bstatus\b/, weight: 25, label: "status" },
    { pattern: /atrasad[oa]s?/, weight: 30, label: "atrasado(s)" },
    { pattern: /\bbloqueos\b/, weight: 30, label: "bloqueos" },
    { pattern: /(?:\bhealth\b|salud (?:del )?proyecto)/, weight: 35, label: "health/salud del proyecto" },
    { pattern: /(?:\btimeline\b|cronograma)/, weight: 35, label: "timeline/cronograma" },
  ],
  recommendation_request: [
    { pattern: /que (?:me |nos )?recomienda(?:s)?/, weight: 45, label: "que recomienda(s)" },
    { pattern: /que sugieres/, weight: 40, label: "que sugieres" },
    { pattern: /(?:tienes |alguna )?recomendacion/, weight: 30, label: "recomendacion" },
    { pattern: /cual (?:seria|es) (?:el )?siguiente paso/, weight: 30, label: "siguiente paso" },
    { pattern: /what do you recommend/, weight: 45, label: "what do you recommend" },
    { pattern: /next steps?/, weight: 25, label: "next steps" },
    // Sprint 12R calibration — playbook_analysis vocabulary that production folds into
    // recommendation_request (golden corpus mismatches pa-01/02/03/07). Mirrors the enriched
    // classifier's own playbook_analysis pattern list (intent-patterns.ts).
    { pattern: /siguiente mejor accion/, weight: 35, label: "siguiente mejor accion" },
    { pattern: /segun el playbook/, weight: 35, label: "segun el playbook" },
    { pattern: /\bplaybook\b/, weight: 25, label: "playbook" },
  ],
  risk_analysis: [
    { pattern: /que riesgos (?:ves|hay|existen)/, weight: 45, label: "que riesgos ves" },
    { pattern: /analisis de riesgo/, weight: 35, label: "analisis de riesgo" },
    { pattern: /que puede salir mal/, weight: 30, label: "que puede salir mal" },
    { pattern: /\briesgos?\b/, weight: 20, label: "riesgo(s)" },
    { pattern: /what risks/, weight: 45, label: "what risks" },
    { pattern: /\brisk(s)?\b/, weight: 20, label: "risk(s)" },
  ],
  communication_draft: [
    { pattern: /redacta(?:me)?/, weight: 45, label: "redacta(me)" },
    { pattern: /escrib(?:eme|ime)/, weight: 40, label: "escribeme/escribime" },
    { pattern: /correo de seguimiento/, weight: 35, label: "correo de seguimiento" },
    { pattern: /(?:un )?correo (?:para|de)/, weight: 25, label: "correo para/de" },
    { pattern: /draft (?:an? )?(?:email|message)/, weight: 45, label: "draft an email" },
    { pattern: /write (?:me )?(?:an? )?(?:email|message)/, weight: 40, label: "write an email" },
    { pattern: /follow[- ]up email/, weight: 30, label: "follow-up email" },
  ],
  closure_question: [
    { pattern: /podemos cerrar/, weight: 45, label: "podemos cerrar" },
    { pattern: /(?:listo|lista) para cerrar/, weight: 35, label: "listo para cerrar" },
    { pattern: /cerrar (?:el|este) proyecto/, weight: 35, label: "cerrar el proyecto" },
    { pattern: /can we close/, weight: 45, label: "can we close" },
    { pattern: /ready (?:for|to) close/, weight: 35, label: "ready to close" },
    // Sprint 13R calibration — closure/reception/acceptance vocabulary the enriched classifier's
    // closure_billing family already recognized (intent-patterns.ts) but production had no pattern
    // for at all (golden corpus mismatches cb-03/06/08/09/11). Bare single-word patterns are kept
    // at a low weight (20) — well below any communication_draft phrase's score (45+ from
    // "redacta(me)"/"correo (para|de)") — so a message like "redactame un correo de cierre" still
    // resolves to communication_draft, not closure_question (see cd-08 regression guard).
    { pattern: /que (?:nos |le )?falta para (?:el cierre|la recepcion|la aceptacion)/, weight: 40, label: "que falta para cierre/recepcion/aceptacion" },
    { pattern: /pendiente para (?:cierre|recepcion|aceptacion)/, weight: 35, label: "pendiente para cierre/recepcion/aceptacion" },
    { pattern: /recepcion definitiva/, weight: 35, label: "recepcion definitiva" },
    { pattern: /acta de (?:recepcion|aceptacion)/, weight: 35, label: "acta de recepcion/aceptacion" },
    { pattern: /cierre (?:administrativo|tecnico|contractual)/, weight: 30, label: "cierre administrativo/tecnico/contractual" },
    { pattern: /cerrar formalmente|dar por cerrado/, weight: 35, label: "cerrar formalmente/dar por cerrado" },
    { pattern: /\brecepcion\b/, weight: 20, label: "recepcion" },
    { pattern: /\b(?:acta|aceptacion)\b/, weight: 20, label: "acta/aceptacion" },
    { pattern: /\bcierre\b/, weight: 20, label: "cierre" },
  ],
  billing_question: [
    { pattern: /(?:ya )?podemos (?:facturar|cobrar)/, weight: 45, label: "podemos facturar/cobrar" },
    { pattern: /listos? para (?:cobrar|facturar)/, weight: 40, label: "listos para cobrar/facturar" },
    { pattern: /facturaci[o]?n/, weight: 25, label: "facturacion" },
    { pattern: /can we (?:invoice|bill)/, weight: 45, label: "can we invoice/bill" },
    { pattern: /ready to (?:invoice|bill)/, weight: 35, label: "ready to invoice/bill" },
    { pattern: /\binvoic(?:e|ing)\b/, weight: 20, label: "invoice(ing)" },
    { pattern: /\bbilling\b/, weight: 20, label: "billing" },
    // Sprint 13R calibration — billing-blocker vocabulary the enriched classifier's closure_billing
    // family already recognized but production had no pattern for (golden corpus mismatches
    // cb-01/02/10). Bare "cobrar/cobro/cobranza" mirrors the existing bare "facturacion" pattern.
    { pattern: /que (?:nos |le )?falta para (?:facturar|cobrar)/, weight: 40, label: "que falta para facturar/cobrar" },
    { pattern: /pendiente para (?:facturar|cobrar)/, weight: 35, label: "pendiente para facturar/cobrar" },
    { pattern: /\b(?:cobrar|cobro|cobranza)\b/, weight: 20, label: "cobrar/cobro/cobranza" },
  ],
  governance_question: [
    { pattern: /evidencia suficiente/, weight: 45, label: "evidencia suficiente" },
    { pattern: /suficiente evidencia/, weight: 45, label: "suficiente evidencia" },
    { pattern: /tenemos (?:la )?evidencia/, weight: 35, label: "tenemos evidencia" },
    { pattern: /aprobaciones? pendientes?/, weight: 30, label: "aprobaciones pendientes" },
    { pattern: /trazabilidad/, weight: 25, label: "trazabilidad" },
    { pattern: /enough evidence/, weight: 45, label: "enough evidence" },
    { pattern: /\bgovernance\b/, weight: 25, label: "governance" },
  ],
  audit_question: [
    { pattern: /por que (?:recomendaste|sugeriste|dijiste)/, weight: 50, label: "por que recomendaste" },
    { pattern: /explica(?:me)? por que/, weight: 35, label: "explica por que" },
    { pattern: /cual fue la razon/, weight: 30, label: "cual fue la razon" },
    { pattern: /why did you (?:recommend|suggest|say)/, weight: 50, label: "why did you recommend" },
    { pattern: /why was (?:this|that)/, weight: 30, label: "why was this/that" },
  ],
  task_or_action_request: [
    { pattern: /crea(?:me)? una tarea/, weight: 45, label: "crea una tarea" },
    { pattern: /crear (?:una )?tarea/, weight: 40, label: "crear tarea" },
    { pattern: /asigna(?:me)? (?:esto|una tarea)/, weight: 35, label: "asigname una tarea" },
    { pattern: /programa(?:me)? una reunion/, weight: 35, label: "programa una reunion" },
    { pattern: /create a task/, weight: 45, label: "create a task" },
    { pattern: /schedule a meeting/, weight: 35, label: "schedule a meeting" },
    { pattern: /remind me to/, weight: 25, label: "remind me to" },
  ],
  unsupported: [
    { pattern: /capital de|capital of/, weight: 60, label: "capital de/of" },
    { pattern: /clima en|weather in/, weight: 55, label: "clima/weather" },
    { pattern: /receta de|recipe for/, weight: 55, label: "receta/recipe" },
    { pattern: /quien gano el mundial|who won the world cup/, weight: 55, label: "mundial/world cup" },
    { pattern: /chiste|tell me a joke/, weight: 55, label: "chiste/joke" },
    { pattern: /horoscopo|horoscope/, weight: 55, label: "horoscopo/horoscope" },
  ],
};

export function normalizeConversationText(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿¡]/g, "")
    .toLowerCase()
    .trim();
}

const SPANISH_MARKERS = /\b(que|como|donde|cuando|porque|esta|estan|cliente|proyecto|correo|facturar|cerrar|riesgos|tenemos|podemos)\b/;
const ENGLISH_MARKERS = /\b(the|what|how|client|project|email|invoice|close|risk|recommend|task)\b/;

export function detectConversationLanguage(normalizedMessage: string): "es" | "en" | "unknown" {
  const hasSpanish = SPANISH_MARKERS.test(normalizedMessage);
  const hasEnglish = ENGLISH_MARKERS.test(normalizedMessage);
  if (hasSpanish && !hasEnglish) return "es";
  if (hasEnglish && !hasSpanish) return "en";
  if (hasSpanish && hasEnglish) return "es";
  return "unknown";
}
