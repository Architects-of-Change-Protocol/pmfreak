import { createHash } from "node:crypto";

import type { DeliveryPlaybook, PlaybookEngineResult, PlaybookRuleEvaluation, ProjectContextFacts } from "./types";
import type { ProjectConstitutionDraft } from "./constitution-generator";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type { CommunicationDraft } from "./communication-types";
import type { OperationalDraft } from "./operational-intelligence-types";
import type { BillingBlocker, ClosureBillingAssessment, ClosureBillingNextAction, ClosureBlocker } from "./closure-billing-types";
import type {
  CreatePlaybookAuditEventInput,
  PlaybookAuditActor,
  PlaybookAuditEvent,
  PlaybookAuditEventType,
  PlaybookAuditRelatedEntityType,
  PlaybookAuditSeverity,
} from "./playbook-audit-types";

const SYSTEM_ACTOR: PlaybookAuditActor = { type: "system", id: null };

/** The one governed sentence every audit event is required to carry: it records an evaluation
 * or generation, never an executed action. */
const NEVER_EXECUTED_NARRATIVE =
  "Este evento de auditoría registra una evaluación o generación del Playbook Engine; no representa ni desencadena ninguna acción real (no se envió, aprobó, cerró ni facturó nada automáticamente).";

function auditEventFingerprint(
  workspaceId: string,
  projectId: string,
  eventType: PlaybookAuditEventType,
  relatedEntityType: PlaybookAuditRelatedEntityType,
  relatedEntityId: string,
): string {
  return createHash("sha256").update(`${workspaceId}:${projectId}:${eventType}:${relatedEntityType}:${relatedEntityId}`).digest("hex");
}

function buildAuditEvent(input: Required<Pick<CreatePlaybookAuditEventInput, "workspaceId" | "projectId" | "eventType" | "actorType" | "relatedEntityType" | "relatedEntityId" | "summary">> &
  Omit<CreatePlaybookAuditEventInput, "workspaceId" | "projectId" | "eventType" | "actorType" | "relatedEntityType" | "relatedEntityId" | "summary">): PlaybookAuditEvent {
  const evidenceUsed = input.evidenceUsed ?? [];
  const missingEvidence = input.missingEvidence ?? [];
  const approvalRequired = input.approvalRequired ?? false;
  const severity: PlaybookAuditSeverity = input.severity ?? "info";
  const fingerprint = auditEventFingerprint(input.workspaceId, input.projectId, input.eventType, input.relatedEntityType, input.relatedEntityId);
  const createdAt = input.occurredAt ?? new Date().toISOString();

  const evidenceClause = evidenceUsed.length > 0 ? evidenceUsed.join(", ") : "sin evidencia adicional registrada";
  const missingClause = missingEvidence.length > 0 ? ` Falta validar: ${missingEvidence.join(", ")}.` : "";
  const approvalClause = approvalRequired
    ? " Esta evaluación/generación incluye al menos un elemento que requiere aprobación humana antes de ejecutarse."
    : "";

  return {
    id: fingerprint,
    fingerprint,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    summary: input.summary,
    evidenceUsed,
    missingEvidence,
    approvalRequired,
    severity,
    metadata: input.metadata ?? {},
    explanation: {
      summary: input.summary,
      evidenceUsed,
      missingEvidence,
      approvalRequired,
      narrative: `${input.summary} Evidencia usada: ${evidenceClause}.${missingClause}${approvalClause} ${NEVER_EXECUTED_NARRATIVE}`,
    },
    createdAt,
  };
}

/**
 * Generic, validated constructor for a `PlaybookAuditEvent`. Pure — never persists, never emits
 * a real platform event. Every domain-specific `auditXxx` helper below ultimately funnels
 * through the same fingerprinting/explanation logic (`buildAuditEvent`); this function is the
 * entry point for callers that don't have one of those specific domain objects at hand.
 */
export function createPlaybookAuditEvent(input: CreatePlaybookAuditEventInput): PlaybookEngineResult<PlaybookAuditEvent> {
  if (!input.workspaceId || input.workspaceId.trim().length === 0) {
    return { ok: false, error: "workspaceId is required to create a playbook audit event.", failureClass: "validation_failed" };
  }
  if (!input.projectId || input.projectId.trim().length === 0) {
    return { ok: false, error: "projectId is required to create a playbook audit event.", failureClass: "validation_failed" };
  }
  if (!input.relatedEntityId || input.relatedEntityId.trim().length === 0) {
    return { ok: false, error: "relatedEntityId is required to create a playbook audit event.", failureClass: "validation_failed" };
  }
  if (!input.summary || input.summary.trim().length === 0) {
    return { ok: false, error: "summary is required to create a playbook audit event.", failureClass: "validation_failed" };
  }

  return { ok: true, data: buildAuditEvent(input) };
}

/**
 * Audits a Rules Engine evaluation (Sprint 1). `relatedEntityId` identifies the playbook version
 * evaluated, not a single rule — the per-rule evidence is summarized, not enumerated, mirroring
 * how `generatePlaybookRecommendations` reports `indeterminateRuleIds` separately rather than
 * a recommendation per rule.
 */
export function auditRulesEvaluation(
  context: ProjectContextFacts,
  playbook: DeliveryPlaybook,
  evaluations: PlaybookRuleEvaluation[],
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  const fired = evaluations.filter((e) => e.status === "fired");
  const indeterminate = evaluations.filter((e) => e.status === "indeterminate");
  const notFired = evaluations.filter((e) => e.status === "not_fired");

  const evidenceUsed = Array.from(
    new Set(fired.flatMap((e) => e.evidenceUsed.map((ev) => `${e.ruleId}:${ev.fact} = ${ev.value}`))),
  );
  const missingEvidence = Array.from(new Set(evaluations.flatMap((e) => e.evidenceMissing)));

  return buildAuditEvent({
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    eventType: "playbook_rules_evaluated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "rules_evaluation",
    relatedEntityId: `${playbook.id}@${playbook.version}`,
    summary: `Se evaluaron ${evaluations.length} reglas del playbook '${playbook.name}' (v${playbook.version}): ${fired.length} disparadas, ${notFired.length} no disparadas, ${indeterminate.length} indeterminadas.`,
    evidenceUsed,
    missingEvidence,
    approvalRequired: false,
    severity: "info",
    metadata: { playbookId: playbook.id, playbookVersion: playbook.version, firedRuleIds: fired.map((e) => e.ruleId) },
  });
}

/** Audits a Project Constitution draft generation (Sprint 2). `ProjectConstitutionDraft` (Sprint
 * 2) carries no `workspaceId` of its own, so the caller — which always has the source
 * `ProjectContextFacts.workspaceId` on hand — must supply it explicitly. `relatedEntityId` is
 * derived from (projectId, playbookId, playbookVersion) rather than the draft's own
 * `generatedAt`-bearing content, so re-generating the same draft from the same inputs always
 * audits to the same id. */
export function auditConstitutionDraftGenerated(
  draft: ProjectConstitutionDraft,
  workspaceId: string,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  const relatedEntityId = createHash("sha256").update(`${draft.projectId}:${draft.playbookId}:${draft.playbookVersion}`).digest("hex");
  const pendingFields = (
    [
      ["objective", draft.objective],
      ["scopeIn", draft.scopeIn],
      ["scopeOut", draft.scopeOut],
      ["deliverables", draft.deliverables],
      ["acceptanceCriteria", draft.acceptanceCriteria],
      ["stakeholders", draft.stakeholders],
      ["closureRules", draft.closureRules],
      ["billingRules", draft.billingRules],
    ] as const
  ).filter(([, field]) => field.status !== "provided" && field.status !== "derived_from_playbook");

  return buildAuditEvent({
    workspaceId,
    projectId: draft.projectId,
    eventType: "project_constitution_draft_generated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "project_constitution_draft",
    relatedEntityId,
    summary: `Se generó un draft de Project Constitution para el proyecto a partir del playbook '${draft.playbookId}' (v${draft.playbookVersion}), estado '${draft.status}'.`,
    evidenceUsed: [],
    missingEvidence: pendingFields.map(([name]) => name),
    approvalRequired: false,
    severity: pendingFields.length > 0 ? "medium" : "info",
    metadata: { playbookId: draft.playbookId, playbookVersion: draft.playbookVersion, status: draft.status },
  });
}

export function auditRecommendationGenerated(
  recommendation: PlaybookRecommendation,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: recommendation.workspaceId,
    projectId: recommendation.projectId,
    eventType: "recommendation_generated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "recommendation",
    relatedEntityId: recommendation.fingerprint,
    summary: `Se generó la recomendación '${recommendation.title}' a partir de la regla '${recommendation.playbookRuleId}'.`,
    evidenceUsed: recommendation.explanation.evidenceUsed,
    missingEvidence: recommendation.explanation.missingEvidence,
    approvalRequired: recommendation.approvalRequired,
    severity: recommendation.severity,
    metadata: { playbookRuleId: recommendation.playbookRuleId, status: recommendation.status, confidence: recommendation.confidence },
  });
}

/** Audits a recommendation status transition (`recommendation-state.ts`). Distinct
 * `relatedEntityId` per transition (fingerprint + fromStatus + toStatus) so replaying the same
 * transition twice audits identically, while different transitions on the same recommendation
 * each get their own event. */
export function auditRecommendationStateChanged(
  recommendation: Pick<PlaybookRecommendation, "workspaceId" | "projectId" | "fingerprint" | "title">,
  fromStatus: string,
  toStatus: string,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  const relatedEntityId = createHash("sha256").update(`${recommendation.fingerprint}:${fromStatus}:${toStatus}`).digest("hex");
  return buildAuditEvent({
    workspaceId: recommendation.workspaceId,
    projectId: recommendation.projectId,
    eventType: "recommendation_state_changed",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "recommendation",
    relatedEntityId,
    summary: `La recomendación '${recommendation.title}' pasó de '${fromStatus}' a '${toStatus}'.`,
    evidenceUsed: [],
    missingEvidence: [],
    approvalRequired: toStatus === "requires_approval",
    severity: "info",
    metadata: { fromStatus, toStatus, recommendationFingerprint: recommendation.fingerprint },
  });
}

export function auditCommunicationDraftGenerated(
  draft: CommunicationDraft,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: draft.workspaceId,
    projectId: draft.projectId,
    eventType: "communication_draft_generated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "communication_draft",
    relatedEntityId: draft.fingerprint,
    summary: `Se generó un borrador de comunicación (plantilla '${draft.templateId}', canal '${draft.channel}') sin enviarlo.`,
    evidenceUsed: draft.evidenceUsed.map((e) => `${e.fact} = ${e.value}`),
    missingEvidence: draft.missingEvidence,
    approvalRequired: draft.approvalRequired,
    severity: "info",
    metadata: { templateId: draft.templateId, channel: draft.channel, linkedRecommendationId: draft.linkedRecommendationId, missingInputs: draft.missingInputs },
  });
}

export function auditCommunicationDraftStateChanged(
  draft: Pick<CommunicationDraft, "workspaceId" | "projectId" | "fingerprint" | "templateId">,
  fromStatus: string,
  toStatus: string,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  const relatedEntityId = createHash("sha256").update(`${draft.fingerprint}:${fromStatus}:${toStatus}`).digest("hex");
  return buildAuditEvent({
    workspaceId: draft.workspaceId,
    projectId: draft.projectId,
    eventType: "communication_draft_state_changed",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "communication_draft",
    relatedEntityId,
    summary: `El borrador de comunicación (plantilla '${draft.templateId}') pasó de '${fromStatus}' a '${toStatus}'.`,
    evidenceUsed: [],
    missingEvidence: [],
    approvalRequired: toStatus === "approved",
    severity: "info",
    metadata: { fromStatus, toStatus, draftFingerprint: draft.fingerprint },
  });
}

export function auditOperationalDraftGenerated(
  draft: OperationalDraft,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: draft.workspaceId,
    projectId: draft.projectId,
    eventType: "operational_draft_generated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "operational_draft",
    relatedEntityId: draft.fingerprint,
    summary: `Se generó un borrador operativo de tipo '${draft.type}' ('${draft.title}') sin convertirlo en un objeto real.`,
    evidenceUsed: draft.evidenceUsed.map((e) => `${e.fact} = ${e.value}`),
    missingEvidence: draft.missingEvidence,
    approvalRequired: draft.approvalRequired,
    severity: draft.severity,
    metadata: { draftType: draft.type, linkedRecommendationId: draft.linkedRecommendationId, missingInputs: draft.missingInputs },
  });
}

export function auditOperationalDraftStateChanged(
  draft: Pick<OperationalDraft, "workspaceId" | "projectId" | "fingerprint" | "type" | "title">,
  fromStatus: string,
  toStatus: string,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  const relatedEntityId = createHash("sha256").update(`${draft.fingerprint}:${fromStatus}:${toStatus}`).digest("hex");
  return buildAuditEvent({
    workspaceId: draft.workspaceId,
    projectId: draft.projectId,
    eventType: "operational_draft_state_changed",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "operational_draft",
    relatedEntityId,
    summary: `El borrador operativo de tipo '${draft.type}' ('${draft.title}') pasó de '${fromStatus}' a '${toStatus}'.`,
    evidenceUsed: [],
    missingEvidence: [],
    approvalRequired: toStatus === "approved",
    severity: "info",
    metadata: { fromStatus, toStatus, draftFingerprint: draft.fingerprint },
  });
}

export function auditClosureBillingAssessmentGenerated(
  assessment: ClosureBillingAssessment,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: assessment.workspaceId,
    projectId: assessment.projectId,
    eventType: "closure_billing_assessment_generated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "closure_billing_assessment",
    relatedEntityId: assessment.fingerprint,
    summary: `Se generó una evaluación de cierre/facturación: cierre '${assessment.closureStatus}', facturación '${assessment.billingStatus}'.`,
    evidenceUsed: assessment.explanation.evidenceUsed,
    missingEvidence: assessment.explanation.missingEvidence,
    approvalRequired: assessment.approvalRequired,
    severity: assessment.readyForClosure && assessment.readyForBilling ? "info" : "medium",
    metadata: {
      readyForClosure: assessment.readyForClosure,
      readyForBilling: assessment.readyForBilling,
      closureBlockerCount: assessment.closureBlockers.length,
      billingBlockerCount: assessment.billingBlockers.length,
    },
  });
}

/** Audits a single detected closure/billing blocker (Sprint 6). One event per blocker — never
 * batched — so each blocker has an independently traceable audit record keyed by its own
 * (already-fingerprinted) `blocker.id`. */
export function auditClosureBillingBlockerDetected(
  blocker: ClosureBlocker | BillingBlocker,
  assessment: Pick<ClosureBillingAssessment, "workspaceId" | "projectId">,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: assessment.workspaceId,
    projectId: assessment.projectId,
    eventType: "closure_billing_blocker_detected",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "closure_billing_blocker",
    relatedEntityId: blocker.id,
    summary: `Se detectó un bloqueante de tipo '${blocker.type}': ${blocker.description}`,
    evidenceUsed: blocker.evidenceUsed.map((e) => `${e.fact} = ${e.value}`),
    missingEvidence: blocker.missingEvidence,
    approvalRequired: blocker.approvalRequired,
    severity: blocker.severity,
    metadata: { blockerType: blocker.type, relatedChecklistItemId: blocker.relatedChecklistItemId },
  });
}

export function auditClosureBillingNextActionRecommended(
  nextAction: ClosureBillingNextAction,
  assessment: Pick<ClosureBillingAssessment, "workspaceId" | "projectId">,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: assessment.workspaceId,
    projectId: assessment.projectId,
    eventType: "closure_billing_next_action_recommended",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "closure_billing_next_action",
    relatedEntityId: nextAction.id,
    summary: `Se recomendó la siguiente acción de cierre/facturación: ${nextAction.description}`,
    evidenceUsed: [],
    missingEvidence: [],
    approvalRequired: nextAction.approvalRequired,
    severity: nextAction.approvalRequired ? "medium" : "info",
    metadata: { actionType: nextAction.type, relatedBlockerId: nextAction.relatedBlockerId },
  });
}

/** Minimal, structural shape the Sprint 7 governance snapshot passes in — kept local (rather
 * than importing `PlaybookGovernanceSnapshot` from `governance-snapshot-types.ts`) so this
 * module never depends on the orchestrator that depends on it. */
export type GovernanceSnapshotAuditInput = {
  fingerprint: string;
  workspaceId: string;
  projectId: string;
  playbookId: string;
  playbookVersion: number;
  recommendationCount: number;
  communicationDraftCount: number;
  operationalDraftCount: number;
  approvalRequiredCount: number;
  missingEvidenceCount: number;
};

export function auditGovernanceSnapshotGenerated(
  snapshot: GovernanceSnapshotAuditInput,
  actor: PlaybookAuditActor = SYSTEM_ACTOR,
): PlaybookAuditEvent {
  return buildAuditEvent({
    workspaceId: snapshot.workspaceId,
    projectId: snapshot.projectId,
    eventType: "governance_snapshot_generated",
    actorType: actor.type,
    actorId: actor.id ?? null,
    relatedEntityType: "governance_snapshot",
    relatedEntityId: snapshot.fingerprint,
    summary: `Se generó un governance snapshot demo-ready (playbook '${snapshot.playbookId}' v${snapshot.playbookVersion}): ${snapshot.recommendationCount} recomendaciones, ${snapshot.communicationDraftCount} borradores de comunicación, ${snapshot.operationalDraftCount} borradores operativos.`,
    evidenceUsed: [],
    missingEvidence: [],
    approvalRequired: snapshot.approvalRequiredCount > 0,
    severity: snapshot.missingEvidenceCount > 0 ? "medium" : "info",
    metadata: {
      playbookId: snapshot.playbookId,
      playbookVersion: snapshot.playbookVersion,
      approvalRequiredCount: snapshot.approvalRequiredCount,
      missingEvidenceCount: snapshot.missingEvidenceCount,
    },
  });
}

/**
 * Deduplicates audit events by fingerprint, keeping the first occurrence — mirrors
 * `mergePlaybookRecommendations`/`mergeCommunicationDrafts`/`mergeOperationalDrafts`'s
 * "never produce duplicates" rule, applied to the audit trail itself.
 */
export function dedupePlaybookAuditEvents(events: PlaybookAuditEvent[]): PlaybookAuditEvent[] {
  const seen = new Set<string>();
  const deduped: PlaybookAuditEvent[] = [];
  for (const event of events) {
    if (seen.has(event.fingerprint)) continue;
    seen.add(event.fingerprint);
    deduped.push(event);
  }
  return deduped;
}
