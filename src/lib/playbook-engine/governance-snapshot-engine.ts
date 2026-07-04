import { createHash } from "node:crypto";

import { SEED_DELIVERY_PLAYBOOK } from "./seed-playbook";
import { evaluatePlaybookRules } from "./rules-engine";
import { generateProjectConstitutionDraftFromPlaybook } from "./constitution-generator";
import type { ProjectConstitutionDraft, ProjectConstitutionSourceFacts } from "./constitution-generator";
import { generatePlaybookRecommendations, mergePlaybookRecommendations } from "./recommendation-engine";
import { generateCommunicationDraftFromRecommendation, mergeCommunicationDrafts } from "./communication-draft-engine";
import type { CommunicationDraft, CommunicationProjectContext } from "./communication-types";
import { generateOperationalDraftsFromRecommendations } from "./operational-intelligence-engine";
import type { OperationalIntelligenceProjectContext } from "./operational-intelligence-types";
import { evaluateClosureAndBilling } from "./closure-billing-engine";
import type { ClosureBillingProjectContext } from "./closure-billing-types";
import {
  auditClosureBillingAssessmentGenerated,
  auditClosureBillingBlockerDetected,
  auditClosureBillingNextActionRecommended,
  auditCommunicationDraftGenerated,
  auditConstitutionDraftGenerated,
  auditGovernanceSnapshotGenerated,
  auditOperationalDraftGenerated,
  auditRecommendationGenerated,
  auditRulesEvaluation,
  dedupePlaybookAuditEvents,
} from "./playbook-audit-engine";
import type { PlaybookAuditActor, PlaybookAuditEvent } from "./playbook-audit-types";
import type { DeliveryPlaybook, PlaybookEngineResult, ProjectContextFacts } from "./types";
import type { PlaybookGovernanceApprovalItem, PlaybookGovernanceSnapshot, PlaybookGovernanceSnapshotExplanation } from "./governance-snapshot-types";

const SYSTEM_ACTOR: PlaybookAuditActor = { type: "system", id: null };

export type GeneratePlaybookGovernanceSnapshotOptions = {
  playbook?: DeliveryPlaybook;
  constitutionSourceFacts?: ProjectConstitutionSourceFacts;
  communicationProjectContext?: CommunicationProjectContext;
  operationalProjectContext?: OperationalIntelligenceProjectContext;
  closureBillingProjectContext?: ClosureBillingProjectContext;
  /** Defaults to `true`. Set `false` to skip Project Constitution draft generation entirely
   * (e.g. when the caller already has an approved constitution and only wants the rest of the
   * chain re-evaluated). */
  generateConstitutionDraft?: boolean;
  actor?: PlaybookAuditActor;
};

function snapshotFingerprint(
  context: ProjectContextFacts,
  playbook: DeliveryPlaybook,
  recommendations: { fingerprint: string }[],
  communicationDrafts: { fingerprint: string }[],
  operationalDrafts: { fingerprint: string }[],
  closureBillingAssessmentFingerprint: string,
  hasConstitutionDraft: boolean,
): string {
  const recPart = recommendations.map((r) => r.fingerprint).sort().join(",");
  const commPart = communicationDrafts.map((d) => d.fingerprint).sort().join(",");
  const opPart = operationalDrafts.map((d) => d.fingerprint).sort().join(",");
  return createHash("sha256")
    .update(
      `${context.workspaceId}:${context.projectId}:${playbook.id}:${playbook.version}:${hasConstitutionDraft}:${recPart}:${commPart}:${opPart}:${closureBillingAssessmentFingerprint}`,
    )
    .digest("hex");
}

/**
 * The Sprint 7 integration orchestrator: runs the full Playbook Engine chain — Rules Engine
 * (Sprint 1) → Project Constitution Generator (Sprint 2) → Recommendation Engine (Sprint 3) →
 * Communications Playbook (Sprint 4) → Operational Intelligence (Sprint 5) → Closure & Billing
 * Intelligence (Sprint 6) → Audit Trail (Sprint 7) — and returns a single, demo-ready,
 * governed snapshot. Pure: no persistence, no real event emission, no sends, no automatic
 * approvals/closure/billing. Every governed artifact (recommendation, draft, assessment, audit
 * event) is deduplicated by its own fingerprint before landing in the snapshot.
 */
export function generatePlaybookGovernanceSnapshot(
  context: ProjectContextFacts,
  options: GeneratePlaybookGovernanceSnapshotOptions = {},
): PlaybookEngineResult<PlaybookGovernanceSnapshot> {
  if (!context.projectId || context.projectId.trim().length === 0) {
    return { ok: false, error: "context.projectId is required to generate a governance snapshot.", failureClass: "validation_failed" };
  }
  if (!context.workspaceId || context.workspaceId.trim().length === 0) {
    return { ok: false, error: "context.workspaceId is required to generate a governance snapshot.", failureClass: "validation_failed" };
  }

  const playbook = options.playbook ?? SEED_DELIVERY_PLAYBOOK;
  const actor = options.actor ?? SYSTEM_ACTOR;
  const shouldGenerateConstitution = options.generateConstitutionDraft !== false;

  const auditEvents: PlaybookAuditEvent[] = [];

  // 1. Rules Engine (Sprint 1)
  const evaluations = evaluatePlaybookRules(playbook, context);
  auditEvents.push(auditRulesEvaluation(context, playbook, evaluations, actor));

  // 2. Project Constitution Generator (Sprint 2)
  let constitutionDraft: ProjectConstitutionDraft | null = null;
  if (shouldGenerateConstitution) {
    const constitutionResult = generateProjectConstitutionDraftFromPlaybook(context, playbook, options.constitutionSourceFacts);
    if (!constitutionResult.ok) return constitutionResult;
    constitutionDraft = constitutionResult.data;
    auditEvents.push(auditConstitutionDraftGenerated(constitutionDraft, context.workspaceId, actor));
  }

  // 3. Recommendation Engine (Sprint 3)
  const recommendationsResult = generatePlaybookRecommendations(context, playbook);
  if (!recommendationsResult.ok) return recommendationsResult;
  const recommendations = mergePlaybookRecommendations([], recommendationsResult.data.recommendations);
  for (const recommendation of recommendations) auditEvents.push(auditRecommendationGenerated(recommendation, actor));

  // 4. Communications Playbook (Sprint 4)
  const rawCommunicationDrafts: CommunicationDraft[] = [];
  for (const recommendation of recommendations) {
    const draftResult = generateCommunicationDraftFromRecommendation(recommendation, options.communicationProjectContext ?? {});
    if (!draftResult.ok) return draftResult;
    rawCommunicationDrafts.push(draftResult.data);
  }
  const communicationDrafts = mergeCommunicationDrafts([], rawCommunicationDrafts);
  for (const draft of communicationDrafts) auditEvents.push(auditCommunicationDraftGenerated(draft, actor));

  // 5. Operational Intelligence (Sprint 5) — already deduplicated by fingerprint internally.
  const operationalDraftsResult = generateOperationalDraftsFromRecommendations(recommendations, options.operationalProjectContext ?? {});
  if (!operationalDraftsResult.ok) return operationalDraftsResult;
  const operationalDrafts = operationalDraftsResult.data;
  for (const draft of operationalDrafts) auditEvents.push(auditOperationalDraftGenerated(draft, actor));

  // 6. Closure & Billing Intelligence (Sprint 6)
  const closureBillingResult = evaluateClosureAndBilling(context, {
    playbook,
    constitution: constitutionDraft,
    recommendations,
    operationalDrafts,
    projectContext: options.closureBillingProjectContext,
  });
  if (!closureBillingResult.ok) return closureBillingResult;
  const closureBillingAssessment = closureBillingResult.data;
  auditEvents.push(auditClosureBillingAssessmentGenerated(closureBillingAssessment, actor));
  for (const blocker of [...closureBillingAssessment.closureBlockers, ...closureBillingAssessment.billingBlockers]) {
    auditEvents.push(auditClosureBillingBlockerDetected(blocker, closureBillingAssessment, actor));
  }
  for (const nextAction of closureBillingAssessment.nextBestActions) {
    auditEvents.push(auditClosureBillingNextActionRecommended(nextAction, closureBillingAssessment, actor));
  }

  // 7. Approval-required / missing-evidence roll-ups
  const approvalRequiredSummary: PlaybookGovernanceApprovalItem[] = [
    ...recommendations
      .filter((r) => r.approvalRequired)
      .map((r): PlaybookGovernanceApprovalItem => ({ relatedEntityType: "recommendation", relatedEntityId: r.fingerprint, title: r.title, reason: "La recomendación incluye una acción sugerida que requiere aprobación humana." })),
    ...communicationDrafts
      .filter((d) => d.approvalRequired)
      .map((d): PlaybookGovernanceApprovalItem => ({ relatedEntityType: "communication_draft", relatedEntityId: d.fingerprint, title: `Borrador de comunicación (${d.templateId})`, reason: "El borrador debe ser revisado y aprobado antes de poder enviarse manualmente." })),
    ...operationalDrafts
      .filter((d) => d.approvalRequired)
      .map((d): PlaybookGovernanceApprovalItem => ({ relatedEntityType: "operational_draft", relatedEntityId: d.fingerprint, title: d.title, reason: "El borrador operativo requiere aprobación antes de convertirse en un objeto real." })),
    ...closureBillingAssessment.closureBlockers
      .filter((b) => b.approvalRequired)
      .map((b): PlaybookGovernanceApprovalItem => ({ relatedEntityType: "closure_billing_blocker", relatedEntityId: b.id, title: b.description, reason: "El bloqueante de cierre requiere revisión/aprobación humana." })),
    ...closureBillingAssessment.billingBlockers
      .filter((b) => b.approvalRequired)
      .map((b): PlaybookGovernanceApprovalItem => ({ relatedEntityType: "closure_billing_blocker", relatedEntityId: b.id, title: b.description, reason: "El bloqueante de facturación requiere revisión/aprobación humana." })),
    ...closureBillingAssessment.nextBestActions
      .filter((a) => a.approvalRequired)
      .map((a): PlaybookGovernanceApprovalItem => ({ relatedEntityType: "closure_billing_next_action", relatedEntityId: a.id, title: a.description, reason: "La siguiente acción sugerida requiere aprobación humana antes de ejecutarse." })),
  ];

  const missingEvidenceSummary = Array.from(
    new Set([
      ...evaluations.flatMap((e) => e.evidenceMissing),
      ...recommendations.flatMap((r) => r.missingEvidence),
      ...closureBillingAssessment.missingEvidence,
    ]),
  );

  const fingerprint = snapshotFingerprint(
    context,
    playbook,
    recommendations,
    communicationDrafts,
    operationalDrafts,
    closureBillingAssessment.fingerprint,
    constitutionDraft !== null,
  );

  const firedCount = evaluations.filter((e) => e.status === "fired").length;
  const notFiredCount = evaluations.filter((e) => e.status === "not_fired").length;
  const indeterminateCount = evaluations.filter((e) => e.status === "indeterminate").length;

  auditEvents.push(
    auditGovernanceSnapshotGenerated(
      {
        fingerprint,
        workspaceId: context.workspaceId,
        projectId: context.projectId,
        playbookId: playbook.id,
        playbookVersion: playbook.version,
        recommendationCount: recommendations.length,
        communicationDraftCount: communicationDrafts.length,
        operationalDraftCount: operationalDrafts.length,
        approvalRequiredCount: approvalRequiredSummary.length,
        missingEvidenceCount: missingEvidenceSummary.length,
      },
      actor,
    ),
  );

  const demoSummary =
    `Se evaluaron ${evaluations.length} reglas del playbook '${playbook.name}' (v${playbook.version}): ${firedCount} disparadas, ${notFiredCount} no disparadas, ${indeterminateCount} indeterminadas. ` +
    `Se generaron ${recommendations.length} recomendaciones, ${communicationDrafts.length} borradores de comunicación y ${operationalDrafts.length} borradores operativos. ` +
    `Estado de cierre: '${closureBillingAssessment.closureStatus}' (readyForClosure=${closureBillingAssessment.readyForClosure}). ` +
    `Estado de facturación: '${closureBillingAssessment.billingStatus}' (readyForBilling=${closureBillingAssessment.readyForBilling}). ` +
    `${approvalRequiredSummary.length} elemento(s) requieren aprobación humana y ${missingEvidenceSummary.length} campo(s) de evidencia siguen faltando. ` +
    "Este snapshot es de solo lectura para fines de demo: no se envió, aprobó, cerró ni facturó nada automáticamente.";

  return {
    ok: true,
    data: {
      id: fingerprint,
      fingerprint,
      projectId: context.projectId,
      workspaceId: context.workspaceId,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
      rulesEvaluationSummary: {
        totalRules: evaluations.length,
        firedCount,
        notFiredCount,
        indeterminateCount,
        evaluations,
      },
      constitutionDraft,
      recommendations,
      communicationDrafts,
      operationalDrafts,
      closureBillingAssessment,
      auditEvents: dedupePlaybookAuditEvents(auditEvents),
      nextBestActions: closureBillingAssessment.nextBestActions,
      approvalRequiredSummary,
      missingEvidenceSummary,
      demoSummary,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Explains a governance snapshot end-to-end: what was evaluated, which rules activated, what
 * was generated at every stage, what's missing, and what needs human approval — closing with
 * the governed sentence PMFreak is required to always say: nothing executed automatically, and
 * this snapshot stays a read-only demo artifact unless a future sprint adds a materialization
 * step.
 */
export function explainPlaybookGovernanceSnapshot(snapshot: PlaybookGovernanceSnapshot): PlaybookGovernanceSnapshotExplanation {
  const rulesActivated = snapshot.rulesEvaluationSummary.evaluations.filter((e) => e.status === "fired").map((e) => `${e.ruleId} — ${e.title}`);
  const recommendationsGenerated = snapshot.recommendations.map((r) => r.title);
  const draftsGenerated = [
    ...snapshot.communicationDrafts.map((d) => `Comunicación (${d.templateId})`),
    ...snapshot.operationalDrafts.map((d) => `Operativo (${d.type}): ${d.title}`),
    ...(snapshot.constitutionDraft ? ["Draft de Project Constitution"] : []),
  ];
  const blockersDetected = [
    ...snapshot.closureBillingAssessment.closureBlockers.map((b) => `Cierre — ${b.type}: ${b.description}`),
    ...snapshot.closureBillingAssessment.billingBlockers.map((b) => `Facturación — ${b.type}: ${b.description}`),
  ];
  const actionsRequiringApproval = snapshot.approvalRequiredSummary.map((a) => `${a.title} (${a.reason})`);

  const whatWasEvaluated =
    `Se evaluó el contexto del proyecto '${snapshot.projectId}' contra el playbook '${snapshot.playbookId}' (v${snapshot.playbookVersion}): ` +
    `${snapshot.rulesEvaluationSummary.totalRules} reglas evaluadas, ${snapshot.rulesEvaluationSummary.firedCount} disparadas.`;

  const narrative =
    `Este governance snapshot encadena Rules Engine, Project Constitution Generator, Recommendation Engine, Communications Playbook, ` +
    `Operational Intelligence y Closure & Billing Intelligence en una sola evaluación gobernada. ` +
    "No se ejecutó ninguna acción real: no se envió ningún correo, no se aprobó ni cerró ni facturó nada automáticamente. " +
    "Es un snapshot de demo/solo-lectura; materializarlo (persistencia, envío real, aprobación) queda fuera de este sprint.";

  return {
    whatWasEvaluated,
    rulesActivated,
    recommendationsGenerated,
    draftsGenerated,
    blockersDetected,
    evidenceUsed: snapshot.rulesEvaluationSummary.evaluations.flatMap((e) => e.evidenceUsed.map((ev) => `${ev.fact} = ${ev.value}`)),
    missingEvidence: snapshot.missingEvidenceSummary,
    actionsRequiringApproval,
    narrative,
  };
}
