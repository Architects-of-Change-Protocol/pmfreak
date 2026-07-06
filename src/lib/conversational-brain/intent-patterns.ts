import type { ConversationIntentFamily, ConversationIntentType } from "./intent-classifier-types";

/**
 * Deterministic pattern rules, matched against a normalized (lowercased, accent-stripped) message.
 * Weights are intentionally restricted to three tiers per the Sprint 9 spec: 5 (strong/explicit
 * phrase), 3 (medium/generic keyword), 1 (weak/loose association). Only the nine "real" families
 * have pattern lists — `unknown` and `needs_clarification` are fallback-only outcomes, never
 * matched directly.
 */
export type IntentPatternRule = {
  pattern: RegExp;
  weight: 5 | 3 | 1;
  label: string;
  intentType: ConversationIntentType;
};

export type RealIntentFamily = Exclude<ConversationIntentFamily, "unknown" | "needs_clarification">;

export const INTENT_FAMILY_PATTERNS: Record<RealIntentFamily, IntentPatternRule[]> = {
  closure_billing: [
    { pattern: /que falta para facturar/, weight: 5, label: "qué falta para facturar", intentType: "billing_blocker_check" },
    { pattern: /(estamos )?listos? para (cobrar|facturar)/, weight: 5, label: "listos para cobrar/facturar", intentType: "billing_readiness_check" },
    { pattern: /ready to bill/, weight: 5, label: "ready to bill", intentType: "billing_readiness_check" },
    { pattern: /\b(facturar|facturacion|cobrar|cobro)\b/, weight: 3, label: "facturar/cobrar (genérico)", intentType: "billing_readiness_check" },
    { pattern: /\b(invoice|billing)\b/, weight: 3, label: "invoice/billing", intentType: "billing_readiness_check" },
    { pattern: /recepcion definitiva/, weight: 5, label: "recepción definitiva", intentType: "reception_status_check" },
    { pattern: /\brecepcion\b/, weight: 3, label: "recepción", intentType: "reception_status_check" },
    { pattern: /\b(acta|aceptacion)\b/, weight: 3, label: "acta/aceptación", intentType: "acceptance_status_check" },
    { pattern: /cerrar (el |este )?proyecto/, weight: 5, label: "cerrar proyecto", intentType: "closure_readiness_check" },
    { pattern: /\bcierre\b/, weight: 3, label: "cierre", intentType: "closure_readiness_check" },
  ],
  communication_draft: [
    { pattern: /redacta(me)?/, weight: 5, label: "redacta(me)", intentType: "email_draft_request" },
    { pattern: /\b(correo|email)\b/, weight: 3, label: "correo/email", intentType: "email_draft_request" },
    { pattern: /ayudame a (contestar|responder)/, weight: 3, label: "ayudame a contestar/responder", intentType: "email_draft_request" },
    { pattern: /(correo de seguimiento|seguimiento formal|dar seguimiento formal)/, weight: 5, label: "seguimiento formal", intentType: "follow_up_draft_request" },
    { pattern: /follow[ -]?up/, weight: 3, label: "follow up", intentType: "follow_up_draft_request" },
    { pattern: /\bminuta\b/, weight: 5, label: "minuta", intentType: "meeting_minutes_request" },
    { pattern: /escalamiento/, weight: 5, label: "escalamiento", intentType: "escalation_draft_request" },
    { pattern: /(pedir|solicitar) recepcion/, weight: 5, label: "pedir/solicitar recepción", intentType: "reception_request_draft" },
    { pattern: /(correo de cierre|comunicacion de cierre)/, weight: 5, label: "correo de cierre", intentType: "closure_communication_request" },
  ],
  playbook_analysis: [
    { pattern: /segun el playbook/, weight: 5, label: "según el playbook", intentType: "playbook_rule_explanation" },
    { pattern: /\bplaybook\b/, weight: 3, label: "playbook", intentType: "playbook_rule_explanation" },
    { pattern: /(que (?:me |nos )?recomienda(?:s)?|recomendacion)/, weight: 5, label: "qué recomienda(s)/recomendación", intentType: "playbook_recommendation_request" },
    { pattern: /que deberia hacer/, weight: 3, label: "qué debería hacer", intentType: "playbook_recommendation_request" },
    // Sprint 12R calibration — production already recognizes "que sugieres" for its
    // recommendation_request intent (intentClassifier.rules.ts); this closes the equivalent gap
    // here so golden corpus case pa-09 stops diverging on vocabulary alone.
    { pattern: /que sugieres/, weight: 5, label: "qué sugieres", intentType: "playbook_recommendation_request" },
    { pattern: /(siguiente mejor accion|next best action)/, weight: 5, label: "siguiente mejor acción", intentType: "governed_next_action_request" },
    { pattern: /(brecha del playbook|que nos falta cumplir del playbook)/, weight: 5, label: "brecha del playbook", intentType: "playbook_gap_analysis" },
  ],
  project_status: [
    { pattern: /como va/, weight: 5, label: "cómo va", intentType: "project_status_summary" },
    { pattern: /\bestado\b/, weight: 3, label: "estado", intentType: "project_status_summary" },
    { pattern: /\bstatus\b/, weight: 3, label: "status", intentType: "project_status_summary" },
    { pattern: /\bavance\b/, weight: 3, label: "avance", intentType: "project_status_summary" },
    { pattern: /(\bhealth\b|salud del proyecto)/, weight: 5, label: "health/salud del proyecto", intentType: "project_health_check" },
    { pattern: /(\btimeline\b|cronograma)/, weight: 5, label: "timeline/cronograma", intentType: "project_timeline_check" },
    { pattern: /atrasado/, weight: 3, label: "atrasado", intentType: "project_timeline_check" },
    { pattern: /bloqueado/, weight: 3, label: "bloqueado", intentType: "project_blockers_check" },
    // Sprint 12R calibration — production already recognizes these two phrasings for
    // project_status_question (intentClassifier.rules.ts); porting them here closes golden corpus
    // mismatches ps-08/ps-09 where production caught real PM phrasing the enriched list missed.
    { pattern: /atorado|estancado|no avanza/, weight: 3, label: "atorado/estancado/no avanza", intentType: "project_status_summary" },
    { pattern: /nadie (?:responde|contesta)/, weight: 3, label: "nadie responde/contesta", intentType: "project_status_summary" },
    // Plural noun form of "bloqueo" — distinct from the "bloqueado" adjective pattern above and
    // from risk_issue_dependency's "bloque(o|ado|an|ando)" pattern; ties with the latter on score
    // and is resolved to project_status via FAMILY_TIE_BREAK_ORDER (see ps-05 in the golden corpus).
    { pattern: /\bbloqueos\b/, weight: 3, label: "bloqueos", intentType: "project_blockers_check" },
  ],
  task_action: [
    { pattern: /crea(r|me)? (una )?tarea|crear tarea/, weight: 5, label: "creá/crear tarea", intentType: "task_creation_request" },
    { pattern: /convert(i|ir)(me)? esto en tarea/, weight: 5, label: "convertí esto en tarea", intentType: "convert_recommendation_request" },
    { pattern: /asigna(r|me)?/, weight: 5, label: "asigná/asignar", intentType: "task_update_request" },
    { pattern: /(marca(r)?|actualiza(r)?|cambia(r)? estado)/, weight: 3, label: "marcá/actualizá/cambiá estado", intentType: "task_update_request" },
    { pattern: /\bcerra\b/, weight: 3, label: "cerrá", intentType: "task_update_request" },
    { pattern: /(ejecuta(r)?|\bmanda\b|\benvia\b|programa(r)?)/, weight: 5, label: "ejecutá/mandá/enviá/programá", intentType: "action_execution_request" },
  ],
  governance_audit: [
    { pattern: /(por que recomendaste|por que sugeriste)/, weight: 5, label: "por qué recomendaste", intentType: "why_recommended_request" },
    { pattern: /(\bpor que\b|\bwhy\b)/, weight: 3, label: "por qué/why", intentType: "recommendation_explanation" },
    { pattern: /evidencia/, weight: 5, label: "evidencia", intentType: "evidence_request" },
    { pattern: /(\baudit\b|auditoria)/, weight: 5, label: "audit/auditoría", intentType: "audit_trail_request" },
    { pattern: /explicame/, weight: 3, label: "explicame", intentType: "recommendation_explanation" },
    { pattern: /justificacion/, weight: 3, label: "justificación", intentType: "recommendation_explanation" },
    { pattern: /que regla/, weight: 3, label: "qué regla", intentType: "recommendation_explanation" },
    { pattern: /quien aprobo/, weight: 3, label: "quién aprobó", intentType: "audit_trail_request" },
    { pattern: /trazabilidad/, weight: 3, label: "trazabilidad", intentType: "audit_trail_request" },
  ],
  risk_issue_dependency: [
    { pattern: /que riesgos hay/, weight: 5, label: "qué riesgos hay", intentType: "risk_check" },
    { pattern: /\briesgos?\b/, weight: 5, label: "riesgo(s)", intentType: "risk_check" },
    { pattern: /\brisks?\b/, weight: 5, label: "risk(s)", intentType: "risk_check" },
    { pattern: /(\bissues?\b|\bproblemas?\b)/, weight: 5, label: "issue/problema", intentType: "issue_check" },
    { pattern: /que dependencias bloquean/, weight: 5, label: "qué dependencias bloquean", intentType: "dependency_check" },
    { pattern: /dependenc(ia|y)(s|as)?/, weight: 5, label: "dependencia/dependency", intentType: "dependency_check" },
    { pattern: /que nos detiene/, weight: 5, label: "qué nos detiene", intentType: "blocker_check" },
    { pattern: /bloque(o|ado|an|ando)/, weight: 3, label: "bloqueo/bloqueado/bloquean", intentType: "blocker_check" },
    { pattern: /(impedimento|\btraba\b)/, weight: 3, label: "impedimento/traba", intentType: "blocker_check" },
  ],
  decision_support: [
    { pattern: /que decision falta/, weight: 5, label: "qué decisión falta", intentType: "decision_needed_check" },
    { pattern: /(\bdecision(es)?\b|decidir)/, weight: 5, label: "decisión/decidir", intentType: "decision_needed_check" },
    { pattern: /quien decide/, weight: 3, label: "quién decide", intentType: "decision_needed_check" },
    { pattern: /(opciones|alternativas)/, weight: 5, label: "opciones/alternativas", intentType: "decision_options_request" },
    { pattern: /(que opcion|recomendarias)/, weight: 5, label: "qué opción/recomendarías", intentType: "decision_recommendation_request" },
  ],
  general_pm_advice: [
    { pattern: /que hago si/, weight: 5, label: "qué hago si", intentType: "general_guidance" },
    { pattern: /que harias/, weight: 5, label: "qué harías", intentType: "general_guidance" },
    { pattern: /ayudame a pensar/, weight: 5, label: "ayudame a pensar", intentType: "general_guidance" },
    { pattern: /como procedo/, weight: 3, label: "cómo procedo", intentType: "general_guidance" },
    { pattern: /consejo/, weight: 3, label: "consejo", intentType: "general_guidance" },
    { pattern: /que hago/, weight: 3, label: "qué hago", intentType: "general_guidance" },
    { pattern: /como manejo/, weight: 5, label: "cómo manejo", intentType: "project_management_advice" },
    { pattern: /recomendame/, weight: 3, label: "recomendame", intentType: "project_management_advice" },
    { pattern: /como le digo/, weight: 5, label: "cómo le digo", intentType: "stakeholder_strategy" },
    { pattern: /(como escalo|deberia escalar)/, weight: 5, label: "cómo escalo/debería escalar", intentType: "escalation_advice" },
  ],
};

export function normalizeIntentText(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿¡?!.,;:]/g, "")
    .toLowerCase()
    .trim();
}
