import { createHash } from "node:crypto";

import { COMMUNICATION_TEMPLATES } from "./communication-templates";
import type {
  CommunicationDraft,
  CommunicationDraftExplanation,
  CommunicationDraftRecipient,
  CommunicationProjectContext,
  CommunicationTemplate,
  CommunicationTemplateId,
  CommunicationTemplateInputContext,
} from "./communication-types";
import type { PlaybookEngineResult } from "./types";
import type { PlaybookRecommendation } from "./recommendation-engine";

const RECEPTION_OR_SIGNOFF_PATTERN = /sign[- ]?off|recepci[oó]n/i;
const BILLING_PATTERN = /facturaci[oó]n|billing|invoice/i;
const CLIENT_NO_RESPONSE_PATTERN = /sin respuesta|no ha respondido|desactualizada|\bstale\b/i;
const DECISION_PATTERN = /decisi[oó]n/i;
const MISSING_ARTIFACT_PATTERN = /no (?:iniciad|generad|definid|aprobad|document|establecid|elaborad|existe|inicializad)|ausente|pendiente/i;
const CLOSURE_READY_PATTERN = /cierre.*listo|checklist.*complet|closure.*ready|closure.*complete/i;
const SCOPE_CHANGE_PATTERN = /cambio de alcance|scope change/i;

function recommendationText(recommendation: PlaybookRecommendation): string {
  return [
    recommendation.playbookRuleId,
    recommendation.title,
    recommendation.detectedSituation,
    recommendation.recommendedAction,
  ].join(" ");
}

/**
 * Maps a governed recommendation to the communication template best suited to it. Priority
 * order mirrors the Sprint 4 spec exactly: reception/sign-off first, then billing, then
 * client-no-response (branched by severity), decision, missing-artifact/evidence, closure,
 * scope change, and finally a safe fallback (`formal_follow_up`) when nothing matches — this
 * function never returns "no template", since every recommendation deserves a governed,
 * editable draft even when the match is generic.
 */
export function selectCommunicationTemplateForRecommendation(
  recommendation: PlaybookRecommendation,
): CommunicationTemplateId {
  const text = recommendationText(recommendation);

  if (RECEPTION_OR_SIGNOFF_PATTERN.test(text)) return "reception_request";
  if (BILLING_PATTERN.test(text)) return "billing_enablement_follow_up";

  if (CLIENT_NO_RESPONSE_PATTERN.test(text)) {
    if (recommendation.severity === "critical") return "soft_escalation";
    if (recommendation.severity === "high") return "formal_follow_up";
    return "soft_follow_up";
  }

  if (DECISION_PATTERN.test(text)) return "decision_request";
  if (MISSING_ARTIFACT_PATTERN.test(text)) return "information_request";
  if (CLOSURE_READY_PATTERN.test(text)) return "closure_confirmation";
  if (SCOPE_CHANGE_PATTERN.test(text)) return "scope_change_notice";

  return "formal_follow_up";
}

function communicationDraftFingerprint(recommendation: PlaybookRecommendation, templateId: CommunicationTemplateId): string {
  return createHash("sha256").update(`${recommendation.fingerprint}:${templateId}`).digest("hex");
}

function cleanRecipients(recipients: CommunicationDraftRecipient[] | null | undefined): CommunicationDraftRecipient[] {
  return (recipients ?? []).filter((r) => (r.email && r.email.trim()) || (r.name && r.name.trim()));
}

function computeMissingInputs(
  template: CommunicationTemplate,
  recommendation: PlaybookRecommendation,
  projectContext: CommunicationProjectContext,
  recipients: CommunicationDraftRecipient[],
): string[] {
  const additional = projectContext.additionalInputs ?? {};
  const missing: string[] = [];

  for (const input of template.requiredInputs) {
    switch (input) {
      case "recipients":
        if (recipients.length === 0) missing.push("recipients");
        break;
      case "requestedInformation":
        if ((additional.requestedInformation?.length ?? 0) === 0 && recommendation.missingEvidence.length === 0) {
          missing.push("requestedInformation");
        }
        break;
      case "meetingDate":
        if (!additional.meetingDate?.trim()) missing.push("meetingDate");
        break;
      case "attendees":
        if (!additional.attendees?.length) missing.push("attendees");
        break;
      case "decisionsMade":
        if (!additional.decisionsMade?.length) missing.push("decisionsMade");
        break;
      case "decisionNeeded":
        if (!additional.decisionNeeded?.trim()) missing.push("decisionNeeded");
        break;
      case "decisionOwner":
        if (!additional.decisionOwner?.trim()) missing.push("decisionOwner");
        break;
      case "decisionDeadline":
        if (!additional.decisionDeadline?.trim()) missing.push("decisionDeadline");
        break;
      case "billingContactName":
        if (!additional.billingContactName?.trim()) missing.push("billingContactName");
        break;
      case "scopeChangeSummary":
        if (!additional.scopeChangeSummary?.trim()) missing.push("scopeChangeSummary");
        break;
      default:
        break;
    }
  }

  return missing;
}

/**
 * Converts a governed `PlaybookRecommendation` (Sprint 3) into a governed, editable, never-sent
 * `CommunicationDraft`. Pure — no persistence, no event emission, no send. The template is
 * auto-selected unless the caller pins one explicitly. Recipients are only ever populated from
 * `projectContext.recipients`/`cc` (never invented); anything the template needs that the
 * caller didn't supply lands in `missingInputs` and is rendered as a `[PENDIENTE: ...]`
 * placeholder in the body instead of being guessed.
 */
export function generateCommunicationDraftFromRecommendation(
  recommendation: PlaybookRecommendation,
  projectContext: CommunicationProjectContext = {},
  templateId?: CommunicationTemplateId,
): PlaybookEngineResult<CommunicationDraft> {
  if (!recommendation.projectId || recommendation.projectId.trim().length === 0) {
    return { ok: false, error: "recommendation.projectId is required to generate a communication draft.", failureClass: "validation_failed" };
  }
  if (!recommendation.workspaceId || recommendation.workspaceId.trim().length === 0) {
    return { ok: false, error: "recommendation.workspaceId is required to generate a communication draft.", failureClass: "validation_failed" };
  }

  const resolvedTemplateId = templateId ?? selectCommunicationTemplateForRecommendation(recommendation);
  const template = COMMUNICATION_TEMPLATES[resolvedTemplateId];
  if (!template) {
    return { ok: false, error: `Unknown communication template id '${resolvedTemplateId}'.`, failureClass: "validation_failed" };
  }

  const recipients = cleanRecipients(projectContext.recipients);
  const cc = cleanRecipients(projectContext.cc);
  const missingInputs = computeMissingInputs(template, recommendation, projectContext, recipients);

  const templateCtx: CommunicationTemplateInputContext = { recommendation, projectContext, recipients, missingInputs };

  const fingerprint = communicationDraftFingerprint(recommendation, resolvedTemplateId);
  const now = new Date().toISOString();
  const approvalRequired = template.approvalRequired || recommendation.approvalRequired;

  const draftBase: Omit<CommunicationDraft, "explanation"> = {
    id: fingerprint,
    fingerprint,
    projectId: recommendation.projectId,
    workspaceId: recommendation.workspaceId,
    linkedRecommendationId: recommendation.id,
    playbookRuleId: recommendation.playbookRuleId,
    templateId: resolvedTemplateId,
    channel: template.channel,
    status: "draft",
    subject: template.channel === "email" ? template.subjectGenerator?.(templateCtx) ?? null : null,
    body: template.bodyGenerator(templateCtx),
    recipients,
    cc,
    missingInputs,
    evidenceUsed: recommendation.evidenceUsed,
    missingEvidence: recommendation.missingEvidence,
    approvalRequired,
    externalSendRequiresApproval: true,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ok: true,
    data: { ...draftBase, explanation: explainCommunicationDraftGeneration(draftBase as CommunicationDraft) },
  };
}

/**
 * Explains a specific draft: why its template was chosen, which recommendation/rule originated
 * it, what evidence backs it, what's still missing, and — the one sentence PMFreak is required
 * to always say here — that it was never sent automatically.
 */
export function explainCommunicationDraftGeneration(draft: CommunicationDraft): CommunicationDraftExplanation {
  const template = COMMUNICATION_TEMPLATES[draft.templateId];
  const evidenceUsed = draft.evidenceUsed.map((e) => `${e.fact} = ${e.value}`);
  const missingEvidence = [...draft.missingEvidence];
  const missingInputs = [...draft.missingInputs];

  const templateChosenBecause =
    `Se seleccionó el template '${template?.name ?? draft.templateId}' (${draft.templateId}) por coincidir con la naturaleza ` +
    `de la recomendación originada por la regla '${draft.playbookRuleId}'.`;

  const evidenceClause = evidenceUsed.length > 0 ? evidenceUsed.join(", ") : "sin evidencia adicional registrada";
  const missingEvidenceClause = missingEvidence.length > 0 ? `Falta validar: ${missingEvidence.join(", ")}. ` : "";
  const missingInputsClause =
    missingInputs.length > 0
      ? `Antes de poder usarse, requiere completar: ${missingInputs.join(", ")}. `
      : "No requiere datos adicionales para completarse. ";
  const approvalClause = draft.approvalRequired
    ? "Requiere revisión y aprobación humana antes de cualquier envío."
    : "No requiere aprobación adicional, pero de igual forma no fue enviado automáticamente.";

  const narrative =
    `Este borrador de comunicación (${draft.templateId}) fue generado a partir de la recomendación '${draft.linkedRecommendationId}', ` +
    `respaldada por la regla '${draft.playbookRuleId}' del playbook. Evidencia usada: ${evidenceClause}. ` +
    `${missingEvidenceClause}${missingInputsClause}${approvalClause} ` +
    `Este borrador no fue enviado automáticamente; requiere una acción humana explícita para copiarlo, aprobarlo o marcarlo como enviado manualmente.`;

  return {
    templateChosenBecause,
    originRecommendation: draft.linkedRecommendationId,
    supportingRule: draft.playbookRuleId,
    evidenceUsed,
    missingEvidence,
    missingInputs,
    requiresHumanReview: draft.approvalRequired || missingInputs.length > 0,
    narrative,
  };
}

/**
 * Merges freshly generated communication drafts into a previously known set, keyed by
 * fingerprint. Mirrors `mergePlaybookRecommendations` (Sprint 3): never produces duplicates,
 * and a fingerprint already present keeps its prior status (a human decision on a draft must
 * never be silently reset by regenerating it) while refreshing content/evidence-derived fields.
 */
export function mergeCommunicationDrafts(
  previous: CommunicationDraft[],
  next: CommunicationDraft[],
): CommunicationDraft[] {
  const previousByFingerprint = new Map(previous.map((draft) => [draft.fingerprint, draft] as const));
  const merged: CommunicationDraft[] = [];
  const seen = new Set<string>();

  for (const incoming of next) {
    if (seen.has(incoming.fingerprint)) continue;
    seen.add(incoming.fingerprint);

    const existing = previousByFingerprint.get(incoming.fingerprint);
    if (!existing) {
      merged.push(incoming);
      continue;
    }

    merged.push({
      ...existing,
      subject: incoming.subject,
      body: incoming.body,
      recipients: incoming.recipients,
      cc: incoming.cc,
      missingInputs: incoming.missingInputs,
      evidenceUsed: incoming.evidenceUsed,
      missingEvidence: incoming.missingEvidence,
      approvalRequired: incoming.approvalRequired,
      explanation: incoming.explanation,
      updatedAt: incoming.updatedAt,
    });
  }

  return merged;
}
