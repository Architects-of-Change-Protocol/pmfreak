import type { ConversationalGatewayInput, ContextResolution, HandlerResult } from "../types";
import { normalizeConversationText } from "../classifier/intentClassifier.rules";

const GENERIC_FOLLOW_UP_DRAFT = [
  "Asunto sugerido: Seguimiento — [nombre del proyecto]",
  "Cuerpo sugerido: 'Hola [nombre], escribo para dar seguimiento a [tema/entregable]. ¿Podrías confirmarnos [lo que necesitas] antes de [fecha]? Quedamos atentos.'",
];

function pickTemplateHint(normalizedMessage: string): string | null {
  if (/seguimiento|follow[- ]up/.test(normalizedMessage)) return "soft_follow_up";
  if (/recepcion|sign[- ]?off/.test(normalizedMessage)) return "reception_request";
  if (/facturaci[o]?n|billing|invoice/.test(normalizedMessage)) return "billing_enablement_follow_up";
  if (/decision/.test(normalizedMessage)) return "decision_request";
  return null;
}

/**
 * Answers "draft me an email/message" style requests. Prefers a real, governed
 * `CommunicationDraft` (Sprint 4) generated from actual fired recommendations when available;
 * otherwise produces a generic-but-usable draft skeleton so the user is never told "I can't help
 * without more context." Drafting always requires human approval before anything is actually
 * sent — this handler never claims a message was sent.
 */
export function handleCommunicationDraftRequest(input: ConversationalGatewayInput, resolution: ContextResolution): HandlerResult {
  const normalized = normalizeConversationText(input.message);
  const templateHint = pickTemplateHint(normalized);
  const drafts = resolution.project.governanceSnapshot?.communicationDrafts ?? [];
  const matchingDraft = (templateHint ? drafts.find((draft) => draft.templateId === templateHint) : undefined) ?? drafts[0];

  if (!matchingDraft) {
    return {
      mode: "draft",
      headline: resolution.project.available
        ? `No tengo suficiente evidencia de ${resolution.project.projectName ?? resolution.project.projectId} para un borrador específico — aquí va uno genérico que puedes ajustar.`
        : "Sin datos del proyecto no puedo generar un borrador específico, pero aquí va uno genérico que puedes ajustar.",
      body: GENERIC_FOLLOW_UP_DRAFT,
      recommendedNextSteps: [
        "Completa destinatario, entregable y fecha límite antes de enviarlo.",
        "Revisa y aprueba el borrador antes de enviarlo — nada se envía automáticamente.",
      ],
      missingContext: resolution.missingContext,
      requiresApproval: true,
      auditRelevant: true,
      confidence: 50,
      sourced: false,
    };
  }

  return {
    mode: "draft",
    headline: `Borrador de comunicación (${matchingDraft.templateId}) listo para revisar.`,
    body: [matchingDraft.subject ? `Asunto: ${matchingDraft.subject}` : "Sin asunto (nota interna).", matchingDraft.body],
    recommendedNextSteps: ["Revisa y ajusta el borrador antes de aprobarlo.", "Aprueba el envío manualmente — no se envía automáticamente."],
    missingContext: resolution.missingContext,
    requiresApproval: true,
    auditRelevant: true,
    confidence: 85,
    sourced: true,
  };
}
