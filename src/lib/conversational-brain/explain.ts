export type IntentClassifierCapabilityExplain = {
  capability: string;
  purpose: string;
  scope: string;
  intentFamilies: string[];
  isDeterministic: boolean;
  usesLLM: boolean;
  limits: string[];
  nextSprints: string[];
};

/**
 * Capability explanation for the Sprint 9 Intent Classifier — the first stage of the
 * Conversational Brain pipeline after the Conversation Gateway (Sprint 8). See
 * `docs/conversational-brain-intent-classifier.md` for the full design.
 */
export function explainIntentClassifierCapability(): IntentClassifierCapabilityExplain {
  return {
    capability: "conversational-brain-intent-classifier",
    purpose:
      "Clasifica de forma determinística el mensaje normalizado del Conversation Gateway en una intención estructurada " +
      "(familia + tipo + señales + banderas de riesgo), para que el resto del Conversational Brain sepa qué tipo de " +
      "pregunta o solicitud está haciendo el usuario antes de resolver contexto o decidir una ruta.",
    scope:
      "Cubre 9 familias de intención (general_pm_advice, project_status, playbook_analysis, communication_draft, " +
      "closure_billing, governance_audit, task_action, decision_support, risk_issue_dependency) más dos resultados de " +
      "reserva (needs_clarification, unknown), cada una con scoring por patrones ponderados, confidence, rationale y " +
      "candidateRoutes.",
    intentFamilies: [
      "general_pm_advice",
      "project_status",
      "playbook_analysis",
      "communication_draft",
      "closure_billing",
      "governance_audit",
      "task_action",
      "decision_support",
      "risk_issue_dependency",
      "unknown",
      "needs_clarification",
    ],
    isDeterministic: true,
    usesLLM: false,
    limits: [
      "No resuelve contexto de proyecto: solo marca `requiresProjectContext` y agrega `missingClarifications` cuando " +
        "falta un `projectId`, pero nunca decide si es seguro rutear (`safeToRoute` es responsabilidad del Context Resolver).",
      "No decide la ruta final: `candidateRoutes` es solo una sugerencia por familia, no una decisión de Route Decision.",
      "No llama adaptadores de dominio ni compone respuestas.",
      "No lee ni escribe en base de datos, no llama Supabase, no hace fetch de red.",
      "No envía correos, no crea tareas, no escribe RAID ni decisiones, no ejecuta nada.",
      "El matching es por patrones de texto (regex sobre texto normalizado), no hay comprensión semántica profunda ni LLM.",
    ],
    nextSprints: [
      "Sprint 10: Context Resolver — decide qué evidencia de proyecto está realmente disponible y si es seguro rutear.",
      "Sprint 11 (o posterior): Route Decision — traduce candidateRoutes + contexto resuelto en una decisión de ruteo final.",
    ],
  };
}
