import { PLAYBOOK_DEMO_SCENARIOS } from "../../demo-scenarios";
import type { ProjectContextFacts } from "../../types";
import { runConversationalBrainGateway } from "../gateway/conversationalBrainGateway";
import type { BrainRoute, ConversationalGatewayInput, ConversationalGatewayResult } from "../types";

/**
 * Demo scenarios (Sprint 8) — realistic natural-language messages exercising the full
 * Conversational Brain Gateway chain end-to-end: classification, context resolution, routing,
 * and response composition. Mirrors the spirit of `../demo-scenarios.ts` (Sprint 7): hand-picked
 * fixtures, never persisted, never wired to a real conversation.
 */
export type ConversationalDemoScenarioId =
  | "open_pm_advice"
  | "informal_blocked_project"
  | "project_status_query"
  | "draft_follow_up_email"
  | "billing_readiness"
  | "governance_evidence"
  | "audit_explanation"
  | "unsupported_trivia";

export type ConversationalDemoScenario = {
  id: ConversationalDemoScenarioId;
  title: string;
  description: string;
  input: ConversationalGatewayInput;
  expectedRoute: BrainRoute;
};

/** A "riesgos críticos abiertos durante ejecución" fixture — built directly (rather than reused
 * from `../demo-scenarios.ts`, whose fixtures are all `fase: cierre`) so the audit-explanation
 * scenario has a real fired recommendation whose text actually mentions "escalar". */
const EXECUTION_CRITICAL_RISK_CONTEXT: ProjectContextFacts = {
  projectId: "demo-conversation-execution-risk",
  workspaceId: "demo-conversation-workspace",
  phase: "ejecucion",
  hasApprovedCharter: true,
  hasApprovedConstitution: true,
  hasScopeBaseline: true,
  hasWbs: true,
  hasScheduleBaseline: true,
  hasBudgetBaseline: true,
  hasRiskRegister: true,
  hasStakeholderMap: true,
  hasCommunicationsPlan: true,
  hasClosureChecklistStarted: null,
  hasFinalInvoiceIssued: null,
  hasClientSignoff: null,
  openCriticalRisks: 2,
  openHighRisks: 0,
  openIssues: 0,
  overdueTasks: 0,
  daysSinceLastStatusUpdate: 2,
  scheduleVarianceDays: 0,
  budgetVariancePercent: 0,
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
  openCriticalDependencies: 0,
  openBlockingIssues: 0,
  metadata: {},
};

export const CONVERSATIONAL_DEMO_SCENARIOS: Record<ConversationalDemoScenarioId, ConversationalDemoScenario> = {
  open_pm_advice: {
    id: "open_pm_advice",
    title: "Consejo abierto de PM",
    description: "Pregunta abierta sin proyecto activo — debe responderse con guía útil sin pedir contexto.",
    input: { message: "¿Qué hago si el cliente no responde?" },
    expectedRoute: "general_pm_advisor",
  },
  informal_blocked_project: {
    id: "informal_blocked_project",
    title: "Proyecto bloqueado (informal)",
    description: "Frase informal centroamericana reportando un proyecto atascado — debe detectar el bloqueo operativo.",
    input: { message: "Mae este proyecto está pegado y nadie responde." },
    expectedRoute: "project_status_handler",
  },
  project_status_query: {
    id: "project_status_query",
    title: "Consulta de estado con proyecto activo",
    description: "Pregunta directa sobre qué bloquea el proyecto, con un proyecto activo y evidencia real conectada.",
    input: {
      message: "¿Qué está bloqueando este proyecto?",
      activeProjectId: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.context.projectId,
      activeProjectName: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.title,
      workspaceId: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.context.workspaceId,
      projectState: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.context,
    },
    expectedRoute: "project_status_handler",
  },
  draft_follow_up_email: {
    id: "draft_follow_up_email",
    title: "Redactar correo de seguimiento",
    description: "Solicitud de borrador de comunicación sin proyecto conectado — debe producir un borrador genérico útil.",
    input: { message: "Redactame un correo de seguimiento." },
    expectedRoute: "communications_handler",
  },
  billing_readiness: {
    id: "billing_readiness",
    title: "Lista para facturar",
    description: "Pregunta de facturación sobre un proyecto con recepción del cliente pendiente — nunca debe afirmar que está listo.",
    input: {
      message: "¿Ya podemos facturar?",
      activeProjectId: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.context.projectId,
      activeProjectName: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.title,
      workspaceId: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.context.workspaceId,
      projectState: PLAYBOOK_DEMO_SCENARIOS.pending_reception_billing_blocker.context,
    },
    expectedRoute: "closure_billing_handler",
  },
  governance_evidence: {
    id: "governance_evidence",
    title: "Evidencia suficiente para gobernanza",
    description: "Pregunta de gobernanza sobre un proyecto con evidencia técnica/UAT pendiente.",
    input: {
      message: "¿Tenemos evidencia suficiente para cerrar?",
      activeProjectId: PLAYBOOK_DEMO_SCENARIOS.web_software_uat_evidence_pending.context.projectId,
      activeProjectName: PLAYBOOK_DEMO_SCENARIOS.web_software_uat_evidence_pending.title,
      workspaceId: PLAYBOOK_DEMO_SCENARIOS.web_software_uat_evidence_pending.context.workspaceId,
      projectState: PLAYBOOK_DEMO_SCENARIOS.web_software_uat_evidence_pending.context,
    },
    expectedRoute: "governance_handler",
  },
  audit_explanation: {
    id: "audit_explanation",
    title: "Explicación de auditoría",
    description: "Pregunta sobre por qué se recomendó escalar, con un proyecto en ejecución con riesgos críticos abiertos.",
    input: {
      message: "¿Por qué recomendaste escalar?",
      activeProjectId: EXECUTION_CRITICAL_RISK_CONTEXT.projectId,
      activeProjectName: "Proyecto en ejecución con riesgos críticos",
      workspaceId: EXECUTION_CRITICAL_RISK_CONTEXT.workspaceId,
      projectState: EXECUTION_CRITICAL_RISK_CONTEXT,
    },
    expectedRoute: "audit_handler",
  },
  unsupported_trivia: {
    id: "unsupported_trivia",
    title: "Pregunta fuera de dominio",
    description: "Trivia sin relación con gestión de proyectos — debe redirigirse educadamente.",
    input: { message: "¿Cuál es la capital de Francia?" },
    expectedRoute: "unsupported_handler",
  },
};

/** Pure convenience wrapper: runs the full gateway chain for a named demo scenario. */
export function runConversationalDemoScenario(scenarioId: ConversationalDemoScenarioId): ConversationalGatewayResult {
  const scenario = CONVERSATIONAL_DEMO_SCENARIOS[scenarioId];
  return runConversationalBrainGateway(scenario.input);
}
