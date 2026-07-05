import { createHash } from "node:crypto";

import { SEED_DELIVERY_PLAYBOOK } from "./seed-playbook";
import type { DeliveryPlaybook, PlaybookEngineResult, PlaybookEvidenceUsed, PlaybookFactKey, PlaybookRuleSeverity, ProjectContextFacts } from "./types";
import type { ProjectConstitutionDraft, ProjectConstitutionDraftField } from "./constitution-generator";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type { OperationalDraft, OperationalDraftType } from "./operational-intelligence-types";
import type { CommunicationTemplateId } from "./communication-types";
import type {
  BillingBlocker,
  BillingBlockerType,
  BillingReadinessStatus,
  ClosureBillingAssessment,
  ClosureBillingBlockerEvidenceStatus,
  ClosureBillingExplanation,
  ClosureBillingNextAction,
  ClosureBillingNextActionType,
  ClosureBillingProjectContext,
  ClosureBlocker,
  ClosureBlockerType,
  ClosureChecklist,
  ClosureChecklistItem,
  ClosureChecklistItemStatus,
  ClosureReadinessStatus,
} from "./closure-billing-types";

// ─── Checklist construction ────────────────────────────────────────────────────

function boolStatus(value: boolean | null): ClosureChecklistItemStatus {
  if (value === true) return "complete";
  if (value === false) return "missing";
  return "requires_validation";
}

function countStatus(value: number | null): ClosureChecklistItemStatus {
  if (value === null) return "requires_validation";
  return value === 0 ? "complete" : "missing";
}

function applicableBoolStatus(applicable: boolean | null, value: boolean | null): ClosureChecklistItemStatus {
  if (applicable === false) return "not_applicable";
  if (value === true) return "complete";
  if (applicable === true && value === false) return "missing";
  return "requires_validation";
}

/** No constitution supplied is "we don't know", never "missing" — mirrors the "no inventar
 * datos" rule the rest of the Playbook Engine follows for `ProjectContextFacts`. */
function constitutionFieldStatus(
  constitution: ProjectConstitutionDraft | null | undefined,
  field: ProjectConstitutionDraftField<unknown> | undefined,
): ClosureChecklistItemStatus {
  if (!constitution || !field) return "requires_validation";
  if (field.status === "provided" || field.status === "derived_from_playbook") return "complete";
  if (field.status === "requires_validation") return "requires_validation";
  return "missing"; // pending_definition | not_available
}

function buildItem(params: {
  id: string;
  label: string;
  category: ClosureChecklistItem["category"];
  status: ClosureChecklistItemStatus;
  evidenceKey: PlaybookFactKey | null;
  blockingClosure: boolean;
  blockingBilling: boolean;
  source: ClosureChecklistItem["source"];
  incompleteNote: string;
}): ClosureChecklistItem {
  return {
    id: params.id,
    label: params.label,
    category: params.category,
    status: params.status,
    evidenceKey: params.evidenceKey,
    blockingClosure: params.blockingClosure,
    blockingBilling: params.blockingBilling,
    source: params.source,
    notes: params.status === "complete" || params.status === "not_applicable" ? null : params.incompleteNote,
  };
}

/**
 * Builds the governed closure checklist for a project. Every item's status is derived purely
 * from known evidence — `ProjectContextFacts` (Sprint 1) for execution-time facts, and the
 * `ProjectConstitutionDraft` (Sprint 2, reused rather than duplicated) for `deliverables`,
 * `acceptanceCriteria`, `closureRules`, `billingRules`. Unknown evidence is never treated as
 * "missing"; it becomes `requires_validation` instead.
 */
export function buildClosureChecklist(
  context: ProjectContextFacts,
  constitution?: ProjectConstitutionDraft | null,
  playbook: DeliveryPlaybook = SEED_DELIVERY_PLAYBOOK,
): ClosureChecklist {
  void playbook; // reserved for future phase-gate cross-validation; current gates are static.

  const items: ClosureChecklistItem[] = [
    buildItem({
      id: "constitution_approved",
      label: "Project Constitution aprobada o validada",
      category: "governance",
      status: boolStatus(context.hasApprovedConstitution),
      evidenceKey: "hasApprovedConstitution",
      blockingClosure: true,
      blockingBilling: false,
      source: "playbook",
      incompleteNote: "La Project Constitution debe estar aprobada o validada para gobernar el cierre del proyecto.",
    }),
    buildItem({
      id: "deliverables_defined",
      label: "Entregables definidos",
      category: "technical",
      status: constitutionFieldStatus(constitution, constitution?.deliverables),
      evidenceKey: null,
      blockingClosure: true,
      blockingBilling: false,
      source: "constitution",
      incompleteNote: "Los entregables del proyecto no están definidos (o no validados) en la Project Constitution.",
    }),
    buildItem({
      id: "acceptance_criteria_defined",
      label: "Criterios de aceptación definidos",
      category: "client_acceptance",
      status: constitutionFieldStatus(constitution, constitution?.acceptanceCriteria),
      evidenceKey: null,
      blockingClosure: true,
      blockingBilling: true,
      source: "constitution",
      incompleteNote: "Los criterios de aceptación no están definidos (o no validados) en la Project Constitution.",
    }),
    buildItem({
      id: "technical_evidence_available",
      label: "Evidencia técnica disponible",
      category: "evidence",
      status: boolStatus(context.hasTechnicalEvidence),
      evidenceKey: "hasTechnicalEvidence",
      blockingClosure: true,
      blockingBilling: true,
      source: "project_context",
      incompleteNote: "Falta evidencia técnica que respalde los entregables del proyecto.",
    }),
    buildItem({
      id: "deliverables_completed",
      label: "Entregables completados",
      category: "technical",
      status: boolStatus(context.hasDeliverablesCompleted),
      evidenceKey: "hasDeliverablesCompleted",
      blockingClosure: true,
      blockingBilling: false,
      source: "project_context",
      incompleteNote: "Los entregables del proyecto no están completos.",
    }),
    buildItem({
      id: "critical_risks_resolved",
      label: "Riesgos críticos resueltos o aceptados",
      category: "governance",
      status: countStatus(context.openCriticalRisks),
      evidenceKey: "openCriticalRisks",
      blockingClosure: true,
      blockingBilling: false,
      source: "inferred_rule",
      incompleteNote: "Existen riesgos críticos abiertos sin resolver o aceptar formalmente.",
    }),
    buildItem({
      id: "blocking_issues_resolved",
      label: "Issues bloqueantes resueltos",
      category: "technical",
      status: countStatus(context.openBlockingIssues),
      evidenceKey: "openBlockingIssues",
      blockingClosure: true,
      blockingBilling: true,
      source: "inferred_rule",
      incompleteNote: "Existen issues bloqueantes abiertos.",
    }),
    buildItem({
      id: "critical_dependencies_resolved",
      label: "Dependencias críticas resueltas",
      category: "technical",
      status: countStatus(context.openCriticalDependencies),
      evidenceKey: "openCriticalDependencies",
      blockingClosure: true,
      blockingBilling: true,
      source: "inferred_rule",
      incompleteNote: "Existen dependencias críticas abiertas.",
    }),
    buildItem({
      id: "closure_decisions_made",
      label: "Decisiones de cierre tomadas",
      category: "governance",
      status: boolStatus(context.hasClosureDecisionsMade),
      evidenceKey: "hasClosureDecisionsMade",
      blockingClosure: true,
      blockingBilling: false,
      source: "project_context",
      incompleteNote: "Faltan decisiones de cierre por tomar.",
    }),
    buildItem({
      id: "client_validation_obtained",
      label: "Cliente validó / aceptó",
      category: "client_acceptance",
      status: boolStatus(context.hasClientValidation),
      evidenceKey: "hasClientValidation",
      blockingClosure: true,
      blockingBilling: true,
      source: "project_context",
      incompleteNote: "El cliente no ha validado ni aceptado el trabajo entregado.",
    }),
    buildItem({
      id: "formal_reception_obtained",
      label: "Recepción formal obtenida",
      category: "client_acceptance",
      status: boolStatus(context.hasClientSignoff),
      evidenceKey: "hasClientSignoff",
      blockingClosure: true,
      blockingBilling: true,
      source: "playbook",
      incompleteNote: "No se ha obtenido la recepción/sign-off formal del cliente.",
    }),
    buildItem({
      id: "final_report_delivered",
      label: "Reporte final entregado",
      category: "administrative",
      status: applicableBoolStatus(context.requiresFinalReport, context.hasFinalReportDelivered),
      evidenceKey: "hasFinalReportDelivered",
      blockingClosure: false,
      blockingBilling: true,
      source: "project_context",
      incompleteNote: "El reporte final del proyecto no ha sido entregado.",
    }),
    buildItem({
      id: "billing_rules_validated",
      label: "Reglas de facturación validadas",
      category: "financial",
      status: constitutionFieldStatus(constitution, constitution?.billingRules),
      evidenceKey: null,
      blockingClosure: false,
      blockingBilling: true,
      source: "constitution",
      incompleteNote: "Las reglas de facturación no están definidas (o no validadas) en la Project Constitution.",
    }),
    buildItem({
      id: "purchase_order_available",
      label: "OC / PO disponible",
      category: "commercial",
      status: applicableBoolStatus(context.requiresPurchaseOrder, context.hasPurchaseOrder),
      evidenceKey: "hasPurchaseOrder",
      blockingClosure: false,
      blockingBilling: true,
      source: "project_context",
      incompleteNote: "No se dispone de la Orden de Compra (OC/PO) requerida.",
    }),
    buildItem({
      id: "administrative_documentation_complete",
      label: "Documentación administrativa completa",
      category: "administrative",
      status: applicableBoolStatus(context.requiresAdministrativeDocumentation, context.hasAdministrativeDocumentationComplete),
      evidenceKey: "hasAdministrativeDocumentationComplete",
      blockingClosure: false,
      blockingBilling: true,
      source: "project_context",
      incompleteNote: "La documentación administrativa/de liquidación no está completa.",
    }),
    buildItem({
      id: "internal_billing_approval_obtained",
      label: "Aprobación interna de facturación obtenida",
      category: "governance",
      status: boolStatus(context.hasInternalApprovalForBilling),
      evidenceKey: "hasInternalApprovalForBilling",
      blockingClosure: false,
      blockingBilling: true,
      source: "project_context",
      incompleteNote: "Falta la aprobación interna requerida para facturar.",
    }),
    buildItem({
      id: "closure_rules_validated",
      label: "Reglas de cierre validadas",
      category: "governance",
      status: constitutionFieldStatus(constitution, constitution?.closureRules),
      evidenceKey: null,
      blockingClosure: true,
      blockingBilling: false,
      source: "constitution",
      incompleteNote: "Las reglas de cierre no están definidas (o no validadas) en la Project Constitution.",
    }),
    buildItem({
      id: "closure_checklist_initiated",
      label: "Checklist de cierre iniciado formalmente",
      category: "governance",
      status: boolStatus(context.hasClosureChecklistStarted),
      evidenceKey: "hasClosureChecklistStarted",
      blockingClosure: true,
      blockingBilling: false,
      source: "playbook",
      incompleteNote: "No se ha iniciado formalmente el checklist de cierre del proyecto.",
    }),
  ];

  const completedCount = items.filter((i) => i.status === "complete").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const relevant = items.filter((i) => i.status !== "not_applicable");
  const status = relevant.length === 0 ? "indeterminate" : relevant.every((i) => i.status === "complete") ? "complete" : "incomplete";

  return {
    projectId: context.projectId,
    items,
    completedCount,
    totalCount: items.length,
    missingCount,
    status,
  };
}

// ─── Blocker detection ──────────────────────────────────────────────────────────

function severityForClosureBlockerType(type: ClosureBlockerType): PlaybookRuleSeverity {
  switch (type) {
    case "unresolved_risk":
      return "critical";
    case "missing_deliverable":
    case "missing_acceptance":
    case "missing_evidence":
    case "unresolved_issue":
    case "unresolved_dependency":
    case "unknown_closure_rule":
      return "high";
    case "missing_decision":
    case "other":
    default:
      return "medium";
  }
}

function severityForBillingBlockerType(type: BillingBlockerType): PlaybookRuleSeverity {
  switch (type) {
    case "missing_reception":
    case "missing_signoff":
      return "critical";
    case "missing_acceptance_criteria":
    case "missing_evidence":
    case "missing_validation":
    case "unresolved_issue":
    case "unresolved_dependency":
    case "unknown_billing_rule":
      return "high";
    case "missing_report":
    case "missing_po":
    case "missing_internal_approval":
    case "missing_liquidation":
    case "other":
    default:
      return "medium";
  }
}

function blockerId(context: ProjectContextFacts, kind: "closure" | "billing", type: string, checklistItemId: string): string {
  return createHash("sha256").update(`${context.workspaceId}:${context.projectId}:${kind}-blocker:${type}:${checklistItemId}`).digest("hex");
}

/**
 * A blocker only ever exists for a checklist item whose status is `"missing"` (confirmed absent)
 * or `"requires_validation"` (unknown) — `detectClosureBlockers`/`detectBillingBlockers` already
 * skip `"complete"`/`"not_applicable"` items before reaching this. Reuses the checklist item's own
 * status rather than inventing a parallel confidence value.
 */
function blockerEvidenceStatus(itemStatus: ClosureChecklistItemStatus): ClosureBillingBlockerEvidenceStatus {
  return itemStatus === "missing" ? "missing" : "requires_validation";
}

function itemEvidence(context: ProjectContextFacts, item: ClosureChecklistItem): { evidenceUsed: PlaybookEvidenceUsed[]; missingEvidence: PlaybookFactKey[] } {
  if (!item.evidenceKey) return { evidenceUsed: [], missingEvidence: [] };
  const value = context[item.evidenceKey];
  if (value === null || value === undefined) return { evidenceUsed: [], missingEvidence: [item.evidenceKey] };
  return { evidenceUsed: [{ fact: item.evidenceKey, value }], missingEvidence: [] };
}

function findRelatedRecommendationId(recommendations: PlaybookRecommendation[], factKey: PlaybookFactKey | null): string | null {
  if (!factKey) return null;
  const match = recommendations.find((r) => r.evidenceUsed.some((e) => e.fact === factKey) || r.missingEvidence.includes(factKey));
  return match ? match.id : null;
}

const CLOSURE_ITEM_TO_BLOCKER_TYPE: Record<string, ClosureBlockerType> = {
  constitution_approved: "other",
  deliverables_defined: "missing_deliverable",
  acceptance_criteria_defined: "missing_acceptance",
  technical_evidence_available: "missing_evidence",
  deliverables_completed: "missing_deliverable",
  critical_risks_resolved: "unresolved_risk",
  blocking_issues_resolved: "unresolved_issue",
  critical_dependencies_resolved: "unresolved_dependency",
  closure_decisions_made: "missing_decision",
  client_validation_obtained: "missing_acceptance",
  formal_reception_obtained: "missing_acceptance",
  closure_rules_validated: "unknown_closure_rule",
  closure_checklist_initiated: "other",
};

const BILLING_ITEM_TO_BLOCKER_TYPE: Record<string, BillingBlockerType> = {
  acceptance_criteria_defined: "missing_acceptance_criteria",
  technical_evidence_available: "missing_evidence",
  blocking_issues_resolved: "unresolved_issue",
  critical_dependencies_resolved: "unresolved_dependency",
  client_validation_obtained: "missing_validation",
  formal_reception_obtained: "missing_reception",
  final_report_delivered: "missing_report",
  billing_rules_validated: "unknown_billing_rule",
  purchase_order_available: "missing_po",
  administrative_documentation_complete: "missing_liquidation",
  internal_billing_approval_obtained: "missing_internal_approval",
};

/**
 * Detects closure blockers from the governed checklist. Only items marked `blockingClosure`
 * and not yet `complete`/`not_applicable` produce a blocker — never invented beyond what the
 * checklist already established from real evidence.
 */
export function detectClosureBlockers(
  context: ProjectContextFacts,
  checklist: ClosureChecklist,
  constitution?: ProjectConstitutionDraft | null,
  recommendations: PlaybookRecommendation[] = [],
): ClosureBlocker[] {
  void constitution; // evidence already folded into checklist item statuses.
  const blockers: ClosureBlocker[] = [];

  for (const item of checklist.items) {
    if (!item.blockingClosure || item.status === "complete" || item.status === "not_applicable") continue;
    const type = CLOSURE_ITEM_TO_BLOCKER_TYPE[item.id] ?? "other";
    const severity = severityForClosureBlockerType(type);
    const { evidenceUsed, missingEvidence } = itemEvidence(context, item);

    blockers.push({
      id: blockerId(context, "closure", type, item.id),
      type,
      severity,
      description: item.notes ?? item.label,
      owner: null,
      dueDate: null,
      evidenceUsed,
      missingEvidence,
      approvalRequired: severity === "critical" || severity === "high",
      suggestedAction: closureSuggestedAction(type),
      status: "open",
      evidenceStatus: blockerEvidenceStatus(item.status),
      relatedChecklistItemId: item.id,
      relatedRecommendationId: findRelatedRecommendationId(recommendations, item.evidenceKey),
    });
  }

  return blockers;
}

/**
 * Detects billing blockers from the governed checklist. Mirrors `detectClosureBlockers`, but
 * scoped to `blockingBilling` items — the two lists deliberately overlap on shared evidence
 * (e.g. missing acceptance criteria blocks both) since a single fact can gate both readiness
 * dimensions independently.
 */
export function detectBillingBlockers(
  context: ProjectContextFacts,
  checklist: ClosureChecklist,
  constitution?: ProjectConstitutionDraft | null,
  recommendations: PlaybookRecommendation[] = [],
): BillingBlocker[] {
  void constitution;
  const blockers: BillingBlocker[] = [];

  for (const item of checklist.items) {
    if (!item.blockingBilling || item.status === "complete" || item.status === "not_applicable") continue;
    const type = BILLING_ITEM_TO_BLOCKER_TYPE[item.id] ?? "other";
    const severity = severityForBillingBlockerType(type);
    const { evidenceUsed, missingEvidence } = itemEvidence(context, item);

    blockers.push({
      id: blockerId(context, "billing", type, item.id),
      type,
      severity,
      description: item.notes ?? item.label,
      owner: null,
      dueDate: null,
      evidenceUsed,
      missingEvidence,
      approvalRequired: severity === "critical" || severity === "high",
      suggestedAction: billingSuggestedAction(type),
      status: "open",
      evidenceStatus: blockerEvidenceStatus(item.status),
      relatedChecklistItemId: item.id,
      relatedRecommendationId: findRelatedRecommendationId(recommendations, item.evidenceKey),
    });
  }

  return blockers;
}

function closureSuggestedAction(type: ClosureBlockerType): string {
  switch (type) {
    case "missing_deliverable":
      return "Definir o completar los entregables pendientes del proyecto.";
    case "missing_acceptance":
      return "Obtener la validación/aceptación formal del cliente.";
    case "missing_evidence":
      return "Recopilar y adjuntar la evidencia técnica faltante.";
    case "unresolved_risk":
      return "Resolver o aceptar formalmente los riesgos críticos abiertos.";
    case "unresolved_issue":
      return "Resolver los issues bloqueantes abiertos.";
    case "unresolved_dependency":
      return "Resolver las dependencias críticas abiertas.";
    case "missing_decision":
      return "Tomar las decisiones de cierre pendientes.";
    case "unknown_closure_rule":
      return "Definir y validar las reglas de cierre en la Project Constitution.";
    case "other":
    default:
      return "Revisar manualmente este punto del checklist de cierre.";
  }
}

function billingSuggestedAction(type: BillingBlockerType): string {
  switch (type) {
    case "missing_reception":
    case "missing_signoff":
      return "Solicitar la recepción/sign-off formal del cliente.";
    case "missing_acceptance_criteria":
      return "Definir y validar los criterios de aceptación.";
    case "missing_evidence":
      return "Recopilar y adjuntar la evidencia técnica faltante.";
    case "missing_report":
      return "Preparar y entregar el reporte final del proyecto.";
    case "missing_po":
      return "Solicitar la Orden de Compra (OC/PO) al cliente/comercial.";
    case "missing_validation":
      return "Solicitar la validación formal del cliente.";
    case "missing_internal_approval":
      return "Obtener la aprobación interna requerida para facturar.";
    case "missing_liquidation":
      return "Completar la documentación administrativa/de liquidación.";
    case "unresolved_issue":
      return "Resolver los issues bloqueantes abiertos.";
    case "unresolved_dependency":
      return "Resolver las dependencias críticas abiertas.";
    case "unknown_billing_rule":
      return "Definir y validar las reglas de facturación en la Project Constitution.";
    case "other":
    default:
      return "Revisar manualmente este punto antes de facturar.";
  }
}

// ─── Operational draft type classification ─────────────────────────────────────

function operationalDraftTypesForBlocker(type: ClosureBlockerType | BillingBlockerType): OperationalDraftType[] {
  switch (type) {
    case "unresolved_risk":
      return ["risk"];
    case "unresolved_issue":
    case "missing_deliverable":
    case "missing_report":
    case "missing_liquidation":
    case "missing_internal_approval":
      return ["issue"];
    case "unresolved_dependency":
    case "missing_reception":
    case "missing_signoff":
    case "missing_validation":
      return ["dependency"];
    case "missing_po":
      return ["issue", "dependency"];
    case "unknown_billing_rule":
    case "unknown_closure_rule":
    case "missing_decision":
      return ["decision"];
    case "missing_acceptance":
    case "missing_acceptance_criteria":
      return ["decision", "risk"];
    case "missing_evidence":
    case "other":
    default:
      return [];
  }
}

// ─── Readiness computation ──────────────────────────────────────────────────────

function computeReadiness(items: ClosureChecklistItem[], key: "blockingClosure" | "blockingBilling"): ClosureReadinessStatus | BillingReadinessStatus {
  const relevant = items.filter((i) => i[key] && i.status !== "not_applicable");
  if (relevant.length === 0) return "indeterminate";
  if (relevant.some((i) => i.status === "missing")) return "not_ready";
  if (relevant.every((i) => i.status === "complete")) return "ready";
  return "indeterminate";
}

// ─── Next best actions ──────────────────────────────────────────────────────────

type NextActionAssessmentInput = Pick<
  ClosureBillingAssessment,
  "workspaceId" | "projectId" | "closureBlockers" | "billingBlockers" | "readyForClosure" | "readyForBilling"
>;

function nextActionId(assessment: NextActionAssessmentInput, type: ClosureBillingNextActionType, relatedBlockerId: string | null): string {
  return createHash("sha256")
    .update(`${assessment.workspaceId}:${assessment.projectId}:next-action:${type}:${relatedBlockerId ?? "none"}`)
    .digest("hex");
}

function action(
  assessment: NextActionAssessmentInput,
  type: ClosureBillingNextActionType,
  description: string,
  relatedBlockerId: string | null,
  recommendedCommunicationTemplateId: CommunicationTemplateId | null,
  recommendedOperationalDraftType: OperationalDraftType | null,
  approvalRequired: boolean,
): ClosureBillingNextAction {
  return {
    id: nextActionId(assessment, type, relatedBlockerId),
    type,
    description,
    relatedBlockerId,
    recommendedCommunicationTemplateId,
    recommendedOperationalDraftType,
    approvalRequired,
  };
}

/**
 * Selects the ordered list of governed next-best-actions for a closure/billing assessment.
 * Every action is a *suggestion*: none of them execute anything, they only carry an optional
 * recommended communication template id / operational draft type for downstream (Sprints 4/5)
 * modules to act on with human approval.
 */
export function selectClosureBillingNextBestActions(
  assessment: NextActionAssessmentInput,
  existingOperationalDraftTypes: ReadonlySet<OperationalDraftType> = new Set(),
): ClosureBillingNextAction[] {
  const actions: ClosureBillingNextAction[] = [];
  const allBlockers = [...assessment.closureBlockers, ...assessment.billingBlockers];

  const receptionBlocker = assessment.billingBlockers.find((b) => b.type === "missing_reception" || b.type === "missing_signoff");
  if (receptionBlocker) {
    actions.push(
      action(assessment, "request_formal_reception", "Solicitar la recepción/sign-off formal del cliente.", receptionBlocker.id, "reception_request", null, true),
    );
    actions.push(
      action(
        assessment,
        "billing_enablement_follow_up",
        "La facturación está bloqueada por falta de recepción; dar seguimiento a su habilitación.",
        receptionBlocker.id,
        "billing_enablement_follow_up",
        null,
        true,
      ),
    );
  }

  const evidenceBlocker = allBlockers.find((b) => b.type === "missing_evidence");
  if (evidenceBlocker) {
    actions.push(
      action(assessment, "request_missing_evidence", "Solicitar o cargar la evidencia técnica faltante.", evidenceBlocker.id, "information_request", null, false),
    );
  }

  const validationBlocker = assessment.billingBlockers.find((b) => b.type === "missing_validation");
  if (validationBlocker && !existingOperationalDraftTypes.has("decision")) {
    actions.push(
      action(
        assessment,
        "request_client_validation",
        "Solicitar al cliente la validación/aceptación formal del trabajo entregado.",
        validationBlocker.id,
        "information_request",
        "decision",
        true,
      ),
    );
  }

  const reportBlocker = assessment.billingBlockers.find((b) => b.type === "missing_report");
  if (reportBlocker) {
    actions.push(action(assessment, "prepare_final_report", "Preparar y entregar el reporte final del proyecto.", reportBlocker.id, null, null, false));
  }

  const poBlocker = assessment.billingBlockers.find((b) => b.type === "missing_po");
  if (poBlocker) {
    actions.push(
      action(assessment, "request_po_validation", "Solicitar la validación comercial/administrativa de la Orden de Compra (OC/PO).", poBlocker.id, null, null, true),
    );
  }

  const issueBlocker = allBlockers.find((b) => b.type === "unresolved_issue");
  if (issueBlocker && !existingOperationalDraftTypes.has("issue")) {
    actions.push(
      action(
        assessment,
        "convert_to_operational_issue",
        "Convertir el issue bloqueante en un borrador operativo (Operational Intelligence) para su seguimiento.",
        issueBlocker.id,
        null,
        "issue",
        true,
      ),
    );
  }

  const dependencyBlocker = allBlockers.find((b) => b.type === "unresolved_dependency");
  if (dependencyBlocker && !existingOperationalDraftTypes.has("dependency")) {
    actions.push(
      action(
        assessment,
        "convert_to_operational_dependency",
        "Convertir la dependencia crítica en un borrador operativo (Operational Intelligence) para su seguimiento.",
        dependencyBlocker.id,
        null,
        "dependency",
        true,
      ),
    );
  }

  if (assessment.readyForBilling) {
    actions.push(
      action(assessment, "start_internal_billing_process", "Iniciar el proceso interno de facturación; el proyecto cumple las condiciones registradas.", null, null, null, true),
    );
  }

  if (assessment.readyForClosure) {
    actions.push(
      action(
        assessment,
        "start_administrative_closure",
        "Iniciar el cierre administrativo del proyecto; se cumplen las condiciones de cierre registradas.",
        null,
        "closure_confirmation",
        null,
        true,
      ),
    );
  }

  const unknownRuleBlocker = allBlockers.find((b) => b.type === "unknown_closure_rule" || b.type === "unknown_billing_rule");
  if (unknownRuleBlocker) {
    actions.push(
      action(
        assessment,
        "review_project_constitution_rules",
        "Revisar y validar humanamente las reglas de cierre/facturación en la Project Constitution.",
        unknownRuleBlocker.id,
        null,
        "decision",
        true,
      ),
    );
  }

  return actions;
}

function selectRecommendedCommunicationTemplateId(
  closureBlockers: ClosureBlocker[],
  billingBlockers: BillingBlocker[],
  readyForClosure: boolean,
): CommunicationTemplateId | null {
  const allBlockers = [...closureBlockers, ...billingBlockers];
  if (allBlockers.some((b) => b.type === "missing_reception" || b.type === "missing_signoff")) return "reception_request";
  if (allBlockers.some((b) => b.type === "missing_evidence")) return "information_request";
  if (readyForClosure) return "closure_confirmation";
  if (allBlockers.some((b) => b.severity === "critical")) return "formal_escalation";
  if (allBlockers.some((b) => b.severity === "high")) return "soft_escalation";
  return null;
}

// ─── Main evaluation ─────────────────────────────────────────────────────────────

export type ClosureBillingEvaluationOptions = {
  playbook?: DeliveryPlaybook;
  constitution?: ProjectConstitutionDraft | null;
  recommendations?: PlaybookRecommendation[];
  operationalDrafts?: OperationalDraft[];
  projectContext?: ClosureBillingProjectContext;
};

function assessmentFingerprint(
  context: ProjectContextFacts,
  playbook: DeliveryPlaybook,
  checklist: ClosureChecklist,
  closureBlockers: ClosureBlocker[],
  billingBlockers: BillingBlocker[],
): string {
  const itemsPart = checklist.items.map((i) => `${i.id}:${i.status}`).sort().join(",");
  const closurePart = closureBlockers.map((b) => b.type).sort().join(",");
  const billingPart = billingBlockers.map((b) => b.type).sort().join(",");
  return createHash("sha256")
    .update(`${context.workspaceId}:${context.projectId}:${playbook.id}:${playbook.version}:${itemsPart}:${closurePart}:${billingPart}`)
    .digest("hex");
}

/**
 * Evaluates whether a project is ready for closure and/or billing. Pure — no persistence, no
 * event emission, no execution. Never closes a project, never marks an invoice issued, never
 * sends anything: the result is a governed, explainable, idempotent assessment a human must
 * act on. `context` (Sprint 1's `ProjectContextFacts`) is the only required input; the
 * constitution/recommendations/operationalDrafts/projectContext options are all optional and,
 * when absent, simply leave more checklist items as `requires_validation` instead of being
 * guessed.
 */
export function evaluateClosureAndBilling(
  context: ProjectContextFacts,
  options: ClosureBillingEvaluationOptions = {},
): PlaybookEngineResult<ClosureBillingAssessment> {
  if (!context.projectId || context.projectId.trim().length === 0) {
    return { ok: false, error: "context.projectId is required to evaluate closure & billing readiness.", failureClass: "validation_failed" };
  }
  if (!context.workspaceId || context.workspaceId.trim().length === 0) {
    return { ok: false, error: "context.workspaceId is required to evaluate closure & billing readiness.", failureClass: "validation_failed" };
  }

  const playbook = options.playbook ?? SEED_DELIVERY_PLAYBOOK;
  const constitution = options.constitution ?? null;
  const recommendations = options.recommendations ?? [];
  const operationalDrafts = options.operationalDrafts ?? [];
  const ownerFromContext = options.projectContext?.owner?.trim() || null;
  const dueDateFromContext = options.projectContext?.dueDate?.trim() || null;

  const checklist = buildClosureChecklist(context, constitution, playbook);
  const closureBlockers = detectClosureBlockers(context, checklist, constitution, recommendations).map((b) => ({
    ...b,
    owner: ownerFromContext,
    dueDate: dueDateFromContext,
  }));
  const billingBlockers = detectBillingBlockers(context, checklist, constitution, recommendations).map((b) => ({
    ...b,
    owner: ownerFromContext,
    dueDate: dueDateFromContext,
  }));

  const closureStatus = computeReadiness(checklist.items, "blockingClosure") as ClosureReadinessStatus;
  const billingStatus = computeReadiness(checklist.items, "blockingBilling") as BillingReadinessStatus;
  const readyForClosure = closureStatus === "ready";
  const readyForBilling = billingStatus === "ready";

  const technicalItems = checklist.items.filter((i) => i.category === "technical" && i.status !== "not_applicable");
  const technicalCompletionRatio =
    technicalItems.length === 0 ? null : Math.round((technicalItems.filter((i) => i.status === "complete").length / technicalItems.length) * 100);

  const evidenceUsed: PlaybookEvidenceUsed[] = [];
  const missingEvidence: PlaybookFactKey[] = [];
  for (const item of checklist.items) {
    if (!item.evidenceKey) continue;
    const value = context[item.evidenceKey];
    if (value === null || value === undefined) {
      if (!missingEvidence.includes(item.evidenceKey)) missingEvidence.push(item.evidenceKey);
    } else if (!evidenceUsed.some((e) => e.fact === item.evidenceKey)) {
      evidenceUsed.push({ fact: item.evidenceKey, value });
    }
  }

  const recommendedOperationalDraftTypes = Array.from(
    new Set([...closureBlockers, ...billingBlockers].flatMap((b) => operationalDraftTypesForBlocker(b.type))),
  );

  const existingOperationalDraftTypes = new Set(
    operationalDrafts
      .filter((d) => d.workspaceId === context.workspaceId && d.projectId === context.projectId && d.status !== "discarded")
      .map((d) => d.type),
  );

  const nextActionInput: NextActionAssessmentInput = {
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    closureBlockers,
    billingBlockers,
    readyForClosure,
    readyForBilling,
  };
  const nextBestActions = selectClosureBillingNextBestActions(nextActionInput, existingOperationalDraftTypes);
  const recommendedCommunicationTemplateId = selectRecommendedCommunicationTemplateId(closureBlockers, billingBlockers, readyForClosure);

  const approvalRequired =
    closureBlockers.some((b) => b.approvalRequired) || billingBlockers.some((b) => b.approvalRequired) || nextBestActions.some((a) => a.approvalRequired);

  const fingerprint = assessmentFingerprint(context, playbook, checklist, closureBlockers, billingBlockers);
  const now = new Date().toISOString();

  const assessmentBase: Omit<ClosureBillingAssessment, "explanation"> = {
    id: fingerprint,
    fingerprint,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    playbookId: playbook.id,
    playbookVersion: playbook.version,
    reviewStatus: "draft",
    closureStatus,
    billingStatus,
    readyForClosure,
    readyForBilling,
    technicalCompletionRatio,
    checklist,
    closureBlockers,
    billingBlockers,
    evidenceUsed,
    missingEvidence,
    nextBestActions,
    recommendedCommunicationTemplateId,
    recommendedOperationalDraftTypes,
    approvalRequired,
    createdAt: now,
    updatedAt: now,
  };

  return { ok: true, data: { ...assessmentBase, explanation: explainClosureBillingAssessment(assessmentBase as ClosureBillingAssessment) } };
}

// ─── Explanation ─────────────────────────────────────────────────────────────────

/**
 * Explains a specific assessment: why the project is/isn't ready for closure, why it is/isn't
 * ready for billing, what evidence was used/missing, what blocks it, what to do next, and —
 * the governed sentence PMFreak is required to always say here — that nothing was closed or
 * invoiced automatically.
 */
export function explainClosureBillingAssessment(assessment: ClosureBillingAssessment): ClosureBillingExplanation {
  const evidenceUsed = assessment.evidenceUsed.map((e) => `${e.fact} = ${e.value}`);
  const missingEvidence = [...assessment.missingEvidence];
  const blockerSummaryLine = (b: ClosureBlocker | BillingBlocker) =>
    b.evidenceStatus === "missing" ? `${b.type}: ${b.description}` : `${b.type} (evidencia por validar): ${b.description}`;
  const closureBlockersSummary = assessment.closureBlockers.map(blockerSummaryLine);
  const billingBlockersSummary = assessment.billingBlockers.map(blockerSummaryLine);

  const closureReadinessExplanation = assessment.readyForClosure
    ? "El proyecto cumple todas las condiciones de cierre registradas por el checklist."
    : assessment.closureStatus === "indeterminate"
      ? "No hay evidencia suficiente para determinar si el proyecto está listo para el cierre."
      : `El proyecto no está listo para el cierre: ${closureBlockersSummary.join("; ") || "existen puntos del checklist sin completar."}`;

  const billingReadinessExplanation = assessment.readyForBilling
    ? "El proyecto cumple todas las condiciones de facturación registradas por el checklist."
    : assessment.billingStatus === "indeterminate"
      ? "No hay evidencia suficiente para determinar si el proyecto está listo para facturar."
      : `El proyecto no está listo para facturar: ${billingBlockersSummary.join("; ") || "existen puntos del checklist sin completar."}`;

  const nextBestAction = assessment.nextBestActions[0]?.description ?? null;

  const narrative =
    `${closureReadinessExplanation} ${billingReadinessExplanation} ` +
    `Evidencia usada: ${evidenceUsed.length > 0 ? evidenceUsed.join(", ") : "sin evidencia adicional registrada"}. ` +
    `${missingEvidence.length > 0 ? `Falta validar: ${missingEvidence.join(", ")}. ` : ""}` +
    `${nextBestAction ? `Siguiente mejor acción sugerida: ${nextBestAction} ` : ""}` +
    "Este assessment no cerró ni facturó el proyecto automáticamente: es una evaluación gobernada que requiere una acción y aprobación humana explícitas para cualquier cierre o facturación real.";

  return {
    closureReadinessExplanation,
    billingReadinessExplanation,
    evidenceUsed,
    missingEvidence,
    closureBlockersSummary,
    billingBlockersSummary,
    nextBestAction,
    requiresHumanReview: assessment.approvalRequired,
    narrative,
  };
}
