import type { ContextResolution, HandlerResult } from "../types";

const GENERIC_RECOMMENDATIONS = [
  "Revisa los riesgos abiertos de mayor severidad y confirma que tengan mitigación y dueño.",
  "Valida el estado de aceptación del cliente antes de asumir que el entregable está aceptado.",
  "Confirma que el cronograma y el presupuesto sigan dentro de la línea base.",
];

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Answers "what do you recommend" style questions. Prefers the Recommendation Engine's (Sprint
 * 3) real, evidence-fired recommendations (surfaced on the governance snapshot) over anything
 * invented; falls back to a generic-but-still-useful recommendation checklist when there's no
 * project evidence to reason from.
 */
export function handleRecommendationRequest(resolution: ContextResolution): HandlerResult {
  const recommendations = resolution.project.governanceSnapshot?.recommendations ?? [];

  if (recommendations.length === 0) {
    return {
      mode: "general_guidance",
      headline: resolution.project.available
        ? `Todavía no tengo evidencia suficiente de ${resolution.project.projectName ?? resolution.project.projectId} para una recomendación específica.`
        : "Sin un proyecto conectado no puedo darte una recomendación específica, pero aquí va una guía general.",
      body: [],
      recommendedNextSteps: GENERIC_RECOMMENDATIONS,
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: false,
      confidence: 45,
      sourced: false,
    };
  }

  const top = [...recommendations].sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0)).slice(0, 3);

  return {
    mode: "recommendation",
    headline: `Tengo ${recommendations.length} recomendación(es) activa(s) para ${resolution.project.projectName ?? resolution.project.governanceSnapshot?.projectId}.`,
    body: top.map((rec) => `${rec.title} — ${rec.recommendedAction}`),
    recommendedNextSteps: top.map((rec) => rec.recommendedAction),
    missingContext: resolution.missingContext,
    requiresApproval: top.some((rec) => rec.approvalRequired),
    auditRelevant: true,
    confidence: 85,
    sourced: true,
  };
}
