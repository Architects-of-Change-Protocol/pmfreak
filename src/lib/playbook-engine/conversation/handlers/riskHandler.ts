import type { RiskDraft } from "../../operational-intelligence-types";
import type { ContextResolution, HandlerResult } from "../types";

const GENERIC_RISK_CHECKLIST = [
  "Riesgos técnicos: ¿hay evidencia/UAT pendiente de validar?",
  "Riesgos de cliente: ¿hay decisiones o aprobaciones esperando respuesta?",
  "Riesgos de cronograma/presupuesto: ¿hay variación registrada sin explicar?",
  "Riesgos contractuales: ¿hay cambios de alcance sin pasar por control de cambios?",
];

const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/**
 * Answers "what risks do you see" style questions. Reuses Operational Intelligence's (Sprint 5)
 * risk drafts — themselves derived from real fired recommendations — instead of inventing a risk
 * assessment; falls back to a generic risk-scanning checklist when there's no project evidence.
 */
export function handleRiskAnalysis(resolution: ContextResolution): HandlerResult {
  const operationalDrafts = resolution.project.governanceSnapshot?.operationalDrafts ?? [];
  const risks = operationalDrafts.filter((draft): draft is RiskDraft => draft.type === "risk");

  if (risks.length === 0) {
    return {
      mode: "general_guidance",
      headline: resolution.project.available
        ? `No hay riesgos registrados con evidencia para ${resolution.project.projectName ?? resolution.project.projectId} todavía.`
        : "Sin un proyecto conectado no puedo listar riesgos reales, pero aquí tienes dónde mirar.",
      body: [],
      recommendedNextSteps: GENERIC_RISK_CHECKLIST,
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: false,
      confidence: 45,
      sourced: false,
    };
  }

  const top = [...risks].sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0)).slice(0, 5);

  return {
    mode: "project_specific_analysis",
    headline: `${top.length} riesgo(s) con evidencia registrada en ${resolution.project.projectName ?? resolution.project.governanceSnapshot?.projectId}.`,
    body: top.map((risk) => `[${risk.severity}] ${risk.category}: ${risk.title}${risk.escalationRecommended ? " — se recomienda escalar" : ""}`),
    recommendedNextSteps: top.filter((risk) => risk.escalationRecommended).map((risk) => `Escalar: ${risk.title}`),
    missingContext: resolution.missingContext,
    requiresApproval: top.some((risk) => risk.escalationRecommended || risk.approvalRequired),
    auditRelevant: true,
    confidence: 80,
    sourced: true,
  };
}
