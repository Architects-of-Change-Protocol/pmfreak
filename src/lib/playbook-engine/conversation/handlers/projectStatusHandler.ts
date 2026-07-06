import type { ContextResolution, HandlerResult } from "../types";

const GENERIC_STATUS_BODY = [
  "Sin datos conectados de este proyecto no puedo decirte qué lo está bloqueando específicamente, pero la mayoría de bloqueos caen en una de estas categorías: una decisión pendiente, una aprobación sin dueño, una dependencia externa (cliente/proveedor), o evidencia técnica sin validar.",
];
const GENERIC_STATUS_NEXT_STEPS = [
  "Conecta el estado del proyecto (fase, riesgos abiertos, tareas vencidas) para un diagnóstico específico.",
  "Mientras tanto, pregunta directamente al equipo: '¿qué necesitas para avanzar hoy?' — suele revelar el bloqueador real.",
];

function severityLabel(severity: string): string {
  const labels: Record<string, string> = { critical: "crítica", high: "alta", medium: "media", low: "baja" };
  return labels[severity] ?? severity;
}

/**
 * Answers "what's going on with / what's blocking this project" style questions. When the
 * governance snapshot is available, it reports on real fired rules (Sprint 1's Rules Engine)
 * instead of inventing an assessment; otherwise it falls back to a generic, still-useful
 * diagnostic framework and flags that project context is missing.
 */
export function handleProjectStatusQuestion(resolution: ContextResolution): HandlerResult {
  const snapshot = resolution.project.governanceSnapshot;

  if (!snapshot) {
    return {
      mode: "general_guidance",
      headline: resolution.project.available
        ? `No tengo datos operativos cargados para ${resolution.project.projectName ?? resolution.project.projectId} todavía.`
        : "No hay un proyecto activo identificado en esta conversación.",
      body: GENERIC_STATUS_BODY,
      recommendedNextSteps: GENERIC_STATUS_NEXT_STEPS,
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: false,
      confidence: 45,
      sourced: false,
    };
  }

  const fired = snapshot.rulesEvaluationSummary.evaluations.filter((evaluation) => evaluation.status === "fired");

  if (fired.length === 0) {
    return {
      mode: "project_specific_analysis",
      headline: `No se detectaron bloqueadores activos en ${resolution.project.projectName ?? snapshot.projectId} según la evidencia registrada.`,
      body: [
        `Evaluamos ${snapshot.rulesEvaluationSummary.totalRules} reglas del playbook; ${snapshot.rulesEvaluationSummary.indeterminateCount} quedaron indeterminadas por falta de evidencia.`,
      ],
      recommendedNextSteps:
        snapshot.rulesEvaluationSummary.indeterminateCount > 0
          ? ["Completa la evidencia faltante para descartar bloqueos silenciosos."]
          : [],
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: true,
      confidence: 80,
      sourced: true,
    };
  }

  const bySeverity = [...fired].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const topBlockers = bySeverity.slice(0, 3);

  return {
    mode: "project_specific_analysis",
    headline: `${resolution.project.projectName ?? snapshot.projectId} tiene ${fired.length} bloqueador(es) activo(s) según la evidencia registrada.`,
    body: topBlockers.map((rule) => `[${severityLabel(rule.severity)}] ${rule.title}: ${rule.description}`),
    recommendedNextSteps: topBlockers
      .flatMap((rule) => rule.suggestedActions?.map((action) => action.description) ?? [])
      .slice(0, 5),
    missingContext: resolution.missingContext,
    requiresApproval: topBlockers.some((rule) => rule.suggestedActions?.some((action) => action.approvalRequired)),
    auditRelevant: true,
    confidence: 85,
    sourced: true,
  };
}

function severityRank(severity: string): number {
  const ranks: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return ranks[severity] ?? 0;
}
