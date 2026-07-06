import type { ConversationalGatewayInput, ContextResolution, HandlerResult } from "../types";
import { normalizeConversationText } from "../classifier/intentClassifier.rules";

const METHODOLOGY_EXPLANATION = [
  "Cada recomendación de PMFreak sale de una regla del playbook que se activó con evidencia concreta del proyecto — nunca de una opinión suelta.",
  "La explicación siempre incluye: qué regla se activó, qué evidencia se usó, qué evidencia falta, y si requiere aprobación humana.",
];

/**
 * Answers "why did you recommend X" style questions. Never invents a justification: if there's
 * no governance snapshot (no project evidence run through the engine), it explains the
 * methodology in general terms instead of fabricating a specific reason. When a snapshot exists,
 * it tries to find the recommendation the user is actually asking about by keyword before falling
 * back to the snapshot's own demo summary.
 */
export function handleAuditQuestion(input: ConversationalGatewayInput, resolution: ContextResolution): HandlerResult {
  const snapshot = resolution.project.governanceSnapshot;

  if (!snapshot) {
    return {
      mode: "general_guidance",
      headline: "No tengo un registro de auditoría de este proyecto para señalarte la recomendación exacta.",
      body: METHODOLOGY_EXPLANATION,
      recommendedNextSteps: ["Dime a cuál recomendación o decisión te refieres, o conecta el estado del proyecto para trazarla."],
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: true,
      confidence: 45,
      sourced: false,
    };
  }

  const normalized = normalizeConversationText(input.message);
  const keywords = normalized
    .replace(/por que (?:recomendaste|sugeriste|dijiste)|why did you (?:recommend|suggest|say)|explica(?:me)? por que/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 3);

  const matched = snapshot.recommendations.find((rec) => {
    const text = normalizeConversationText(`${rec.title} ${rec.recommendedAction} ${rec.detectedSituation}`);
    return keywords.some((keyword) => text.includes(keyword));
  });

  if (matched) {
    return {
      mode: "project_specific_analysis",
      headline: `Esta es la trazabilidad de la recomendación '${matched.title}'.`,
      body: [matched.explanation.narrative],
      recommendedNextSteps: [],
      missingContext: resolution.missingContext,
      requiresApproval: false,
      auditRelevant: true,
      confidence: 85,
      sourced: true,
    };
  }

  return {
    mode: "project_specific_analysis",
    headline: "No encontré una recomendación que coincida exactamente con eso — aquí está el resumen de lo evaluado.",
    body: [snapshot.demoSummary],
    recommendedNextSteps: ["Sé más específico sobre cuál recomendación o decisión quieres que explique."],
    missingContext: resolution.missingContext,
    requiresApproval: false,
    auditRelevant: true,
    confidence: 55,
    sourced: true,
  };
}
