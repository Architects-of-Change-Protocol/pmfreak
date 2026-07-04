import type { ProjectContextFacts } from "./types";
import type { ProjectConstitutionSourceFacts } from "./constitution-generator";
import {
  generatePlaybookGovernanceSnapshot,
  type GeneratePlaybookGovernanceSnapshotOptions,
} from "./governance-snapshot-engine";
import type { PlaybookEngineResult } from "./types";
import type { PlaybookGovernanceSnapshot } from "./governance-snapshot-types";

/**
 * Demo project scenarios (Sprint 7) — realistic, hand-picked `ProjectContextFacts` fixtures used
 * to demonstrate the full Playbook Engine chain end-to-end. Every scenario only ever sets
 * *known* facts; anything left `null` genuinely means "unknown" for that demo project, exactly
 * like a real caller would supply. These are demo fixtures, never real project data — nothing
 * here is persisted or wired to a real project.
 */
export type PlaybookDemoScenarioId =
  | "pending_reception_billing_blocker"
  | "security_hardening_client_validation"
  | "web_software_uat_evidence_pending"
  | "ready_for_billing";

export type PlaybookDemoScenario = {
  id: PlaybookDemoScenarioId;
  title: string;
  description: string;
  context: ProjectContextFacts;
  constitutionSourceFacts?: ProjectConstitutionSourceFacts;
};

const BASE_CONTEXT: ProjectContextFacts = {
  projectId: "",
  workspaceId: "",
  phase: "cierre",
  hasApprovedCharter: null,
  hasApprovedConstitution: null,
  hasScopeBaseline: null,
  hasWbs: null,
  hasScheduleBaseline: null,
  hasBudgetBaseline: null,
  hasRiskRegister: null,
  hasStakeholderMap: null,
  hasCommunicationsPlan: null,
  hasClosureChecklistStarted: null,
  hasFinalInvoiceIssued: null,
  hasClientSignoff: null,
  openCriticalRisks: null,
  openHighRisks: null,
  openIssues: null,
  overdueTasks: null,
  daysSinceLastStatusUpdate: null,
  scheduleVarianceDays: null,
  budgetVariancePercent: null,
  hasDeliverablesCompleted: null,
  hasTechnicalEvidence: null,
  hasClientValidation: null,
  hasClosureDecisionsMade: null,
  hasFinalReportDelivered: null,
  requiresFinalReport: null,
  hasPurchaseOrder: null,
  requiresPurchaseOrder: null,
  hasAdministrativeDocumentationComplete: null,
  requiresAdministrativeDocumentation: null,
  hasInternalApprovalForBilling: null,
  openCriticalDependencies: null,
  openBlockingIssues: null,
  metadata: {},
};

const READY_CONSTITUTION_SOURCE_FACTS: ProjectConstitutionSourceFacts = {
  objective: "Entregar el alcance contratado con el cliente.",
  deliverables: ["Entregable principal validado técnicamente"],
  acceptanceCriteria: ["Criterios de aceptación firmados por el cliente"],
  closureRules: ["El cierre requiere recepción formal y checklist completo."],
  billingRules: ["La facturación requiere recepción formal, OC y aprobación interna."],
};

/**
 * A. Public infrastructure project with a pending reception and a billing blocker. Technically
 * complete (deliverables done, no open critical risks/issues/dependencies, internal billing
 * approval obtained) but the client's formal reception/sign-off is still pending — this alone
 * blocks billing even though everything else is ready.
 */
const PENDING_RECEPTION_CONTEXT: ProjectContextFacts = {
  ...BASE_CONTEXT,
  projectId: "demo-project-pending-reception",
  workspaceId: "demo-workspace-public-infra",
  phase: "cierre",
  hasApprovedConstitution: true,
  hasTechnicalEvidence: true,
  hasDeliverablesCompleted: true,
  openCriticalRisks: 0,
  openBlockingIssues: 0,
  openCriticalDependencies: 0,
  hasClosureDecisionsMade: true,
  hasClientValidation: true,
  hasClientSignoff: false, // pending reception — the scenario's central blocker.
  hasFinalInvoiceIssued: false,
  requiresFinalReport: false,
  requiresPurchaseOrder: false,
  requiresAdministrativeDocumentation: false,
  hasInternalApprovalForBilling: true,
  hasClosureChecklistStarted: true,
};

/**
 * B. Security/hardening project requiring client validation. Reception is already in hand, but
 * the client has not validated/accepted the hardening work, and the closure checklist itself was
 * never formally started — both block closure and billing until a human resolves them.
 */
const SECURITY_VALIDATION_CONTEXT: ProjectContextFacts = {
  ...BASE_CONTEXT,
  projectId: "demo-project-security-hardening",
  workspaceId: "demo-workspace-security",
  phase: "cierre",
  hasApprovedConstitution: true,
  hasTechnicalEvidence: true,
  hasDeliverablesCompleted: true,
  openCriticalRisks: 0,
  openBlockingIssues: 0,
  openCriticalDependencies: 0,
  hasClosureDecisionsMade: true,
  hasClientValidation: false, // the scenario's central blocker.
  hasClientSignoff: true,
  hasFinalInvoiceIssued: true,
  requiresFinalReport: false,
  requiresPurchaseOrder: false,
  requiresAdministrativeDocumentation: false,
  hasInternalApprovalForBilling: true,
  hasClosureChecklistStarted: false,
};

/**
 * C. Web/software project with UAT/content/evidence pending. Technical evidence is missing
 * (UAT sign-off, content deliverables) and the client's formal reception is also still pending —
 * both surface as open dependencies/evidence gaps blocking closure and billing.
 */
const WEB_UAT_CONTEXT: ProjectContextFacts = {
  ...BASE_CONTEXT,
  projectId: "demo-project-web-uat",
  workspaceId: "demo-workspace-web-software",
  phase: "cierre",
  hasApprovedConstitution: true,
  hasTechnicalEvidence: false, // UAT/content evidence pending — the scenario's central gap.
  hasDeliverablesCompleted: false,
  openCriticalRisks: 0,
  openBlockingIssues: 0,
  openCriticalDependencies: 0,
  hasClosureDecisionsMade: true,
  hasClientValidation: false,
  hasClientSignoff: false,
  hasFinalInvoiceIssued: false,
  requiresFinalReport: false,
  requiresPurchaseOrder: false,
  requiresAdministrativeDocumentation: false,
  hasInternalApprovalForBilling: false,
  hasClosureChecklistStarted: false,
};

/**
 * D. Ready-for-billing project. Every closure/billing checklist item is satisfied — the
 * assessment reaches `readyForBilling: true`, but the snapshot still never issues an invoice or
 * closes the project automatically; it only ever surfaces a governed, human-approval-gated
 * next action.
 */
const READY_FOR_BILLING_CONTEXT: ProjectContextFacts = {
  ...BASE_CONTEXT,
  projectId: "demo-project-ready-for-billing",
  workspaceId: "demo-workspace-ready",
  phase: "cierre",
  hasApprovedConstitution: true,
  hasTechnicalEvidence: true,
  hasDeliverablesCompleted: true,
  openCriticalRisks: 0,
  openBlockingIssues: 0,
  openCriticalDependencies: 0,
  hasClosureDecisionsMade: true,
  hasClientValidation: true,
  hasClientSignoff: true,
  hasFinalInvoiceIssued: true,
  requiresFinalReport: false,
  requiresPurchaseOrder: false,
  requiresAdministrativeDocumentation: false,
  hasInternalApprovalForBilling: true,
  hasClosureChecklistStarted: true,
};

export const PLAYBOOK_DEMO_SCENARIOS: Record<PlaybookDemoScenarioId, PlaybookDemoScenario> = {
  pending_reception_billing_blocker: {
    id: "pending_reception_billing_blocker",
    title: "Proyecto de infraestructura pública — recepción pendiente",
    description:
      "Proyecto técnicamente completo cuya recepción/sign-off formal del cliente sigue pendiente, bloqueando la facturación.",
    context: PENDING_RECEPTION_CONTEXT,
    constitutionSourceFacts: READY_CONSTITUTION_SOURCE_FACTS,
  },
  security_hardening_client_validation: {
    id: "security_hardening_client_validation",
    title: "Proyecto de seguridad/hardening — validación del cliente pendiente",
    description:
      "Proyecto de hardening con recepción obtenida pero sin validación/aceptación formal del cliente ni checklist de cierre iniciado.",
    context: SECURITY_VALIDATION_CONTEXT,
    constitutionSourceFacts: READY_CONSTITUTION_SOURCE_FACTS,
  },
  web_software_uat_evidence_pending: {
    id: "web_software_uat_evidence_pending",
    title: "Proyecto web/software — UAT y evidencia pendientes",
    description: "Proyecto de desarrollo web con evidencia técnica (UAT/contenido) y recepción del cliente aún pendientes.",
    context: WEB_UAT_CONTEXT,
    constitutionSourceFacts: READY_CONSTITUTION_SOURCE_FACTS,
  },
  ready_for_billing: {
    id: "ready_for_billing",
    title: "Proyecto listo para facturación",
    description: "Proyecto que satisface todo el checklist de cierre/facturación — listo para iniciar el proceso interno de facturación.",
    context: READY_FOR_BILLING_CONTEXT,
    constitutionSourceFacts: READY_CONSTITUTION_SOURCE_FACTS,
  },
};

/**
 * Runs the full governance snapshot chain for a named demo scenario. Pure convenience wrapper
 * around `generatePlaybookGovernanceSnapshot` — never persists, never sends, never executes
 * anything beyond what that function already guarantees.
 */
export function generateDemoGovernanceSnapshot(
  scenarioId: PlaybookDemoScenarioId,
  options: GeneratePlaybookGovernanceSnapshotOptions = {},
): PlaybookEngineResult<PlaybookGovernanceSnapshot> {
  const scenario = PLAYBOOK_DEMO_SCENARIOS[scenarioId];
  return generatePlaybookGovernanceSnapshot(scenario.context, {
    constitutionSourceFacts: scenario.constitutionSourceFacts,
    ...options,
  });
}
