import type { ConversationIntent, ContextResolution, HandlerResult } from "../types";

/**
 * Answers "can we close" / "can we bill" style questions. This is the one handler where the
 * sprint's governing rule is strictest: readiness must never be asserted without evidence.
 * Without a governance snapshot there is no evidence either way, so the answer is always "I
 * can't confirm that" plus the general checklist — never an optimistic guess.
 */
export function handleClosureBillingQuestion(intent: ConversationIntent, resolution: ContextResolution): HandlerResult {
  const isBilling = intent === "billing_question";
  const assessment = resolution.project.governanceSnapshot?.closureBillingAssessment;

  if (!assessment) {
    return {
      mode: "general_guidance",
      headline: isBilling
        ? "No puedo confirmar si el proyecto está listo para facturar sin evidencia registrada — y no voy a asumir que sí lo está."
        : "No puedo confirmar si el proyecto está listo para cerrar sin evidencia registrada — y no voy a asumir que sí lo está.",
      body: [
        isBilling
          ? "Facturar sin recepción formal, aprobación interna y evidencia de aceptación es un riesgo contractual y financiero directo."
          : "Cerrar sin checklist de cierre validado deja pendientes sin trazabilidad.",
      ],
      recommendedNextSteps: [
        "Conecta el estado del proyecto para evaluar el checklist real de cierre/facturación.",
        isBilling ? "Mientras tanto, confirma manualmente: recepción firmada, OC (si aplica), aprobación interna." : "Mientras tanto, confirma manualmente: entregables completos, evidencia técnica, decisiones de cierre tomadas.",
      ],
      missingContext: resolution.missingContext,
      requiresApproval: true,
      auditRelevant: true,
      confidence: 45,
      sourced: false,
    };
  }

  const ready = isBilling ? assessment.readyForBilling : assessment.readyForClosure;
  const blockers = isBilling ? assessment.billingBlockers : assessment.closureBlockers;
  const status = isBilling ? assessment.billingStatus : assessment.closureStatus;

  const headline = ready
    ? `Según la evidencia registrada, el checklist de ${isBilling ? "facturación" : "cierre"} está completo — pero la decisión final sigue siendo tuya.`
    : status === "indeterminate"
      ? `Todavía hay evidencia sin validar para confirmar si está listo para ${isBilling ? "facturar" : "cerrar"}.`
      : `Todavía no está listo para ${isBilling ? "facturar" : "cerrar"} — hay ${blockers.length} bloqueador(es) abierto(s).`;

  return {
    mode: "project_specific_analysis",
    headline,
    body: blockers.slice(0, 5).map((blocker) => `[${blocker.severity}] ${blocker.description}`),
    recommendedNextSteps: assessment.nextBestActions.slice(0, 3).map((action) => action.description),
    missingContext: resolution.missingContext,
    requiresApproval: true,
    auditRelevant: true,
    confidence: 85,
    sourced: true,
  };
}
