import type { ContextResolution, HandlerResult } from "../types";

const GENERIC_GOVERNANCE_PRINCIPLES = [
  "Toda decisión de cierre/facturación debe apoyarse en evidencia registrada, no en supuestos.",
  "Toda acción sensible (enviar, escalar, cerrar, facturar) requiere aprobación humana explícita.",
  "Cada recomendación y decisión debe quedar trazada para poder explicarse después.",
];

/**
 * Answers "do we have enough evidence / governance" style questions. Emphasizes evidence,
 * approvals, and traceability above all — this handler never tells the user things are fine
 * without pointing at what's actually still missing.
 */
export function handleGovernanceQuestion(resolution: ContextResolution): HandlerResult {
  const snapshot = resolution.project.governanceSnapshot;

  if (!snapshot) {
    return {
      mode: "general_guidance",
      headline: "No tengo un snapshot de gobernanza para este proyecto — no puedo confirmar cobertura de evidencia real.",
      body: GENERIC_GOVERNANCE_PRINCIPLES,
      recommendedNextSteps: ["Conecta el estado del proyecto para generar un snapshot de gobernanza real."],
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: true,
      confidence: 45,
      sourced: false,
    };
  }

  const pendingApprovals = snapshot.approvalRequiredSummary;
  const missingEvidence = snapshot.missingEvidenceSummary;

  const headline =
    missingEvidence.length === 0 && pendingApprovals.length === 0
      ? "La evidencia registrada cubre lo necesario y no hay aprobaciones pendientes abiertas."
      : `Hay ${missingEvidence.length} elemento(s) de evidencia faltante y ${pendingApprovals.length} acción(es) esperando aprobación.`;

  return {
    mode: "project_specific_analysis",
    headline,
    body: [
      ...(missingEvidence.length > 0 ? [`Evidencia faltante: ${missingEvidence.slice(0, 8).join(", ")}.`] : []),
      ...(pendingApprovals.length > 0 ? pendingApprovals.slice(0, 5).map((item) => `Pendiente de aprobación: ${item.title} — ${item.reason}`) : []),
    ],
    recommendedNextSteps:
      missingEvidence.length > 0 ? ["Valida y registra la evidencia faltante antes de tomar decisiones de cierre/facturación."] : [],
    missingContext: resolution.missingContext,
    requiresApproval: false,
    auditRelevant: true,
    confidence: 85,
    sourced: true,
  };
}
