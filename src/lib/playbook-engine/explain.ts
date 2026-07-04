import { SEED_DELIVERY_PLAYBOOK } from "./seed-playbook";

export type PlaybookEngineCapabilityExplain = {
  capability: string;
  purpose: string;
  scope: string;
  modules: string[];
  limits: string[];
  phases: string[];
  ruleCount: number;
  governingPrinciples: string[];
};

/**
 * Consolidated capability explanation for the whole Playbook Engine MVP (Sprints 1-7). Every
 * module listed here is pure logic with no DB side effects, no automatic emails, no automatic
 * closure/billing, and no automatic approvals — every governed artifact stops at a human
 * approval gate. See `docs/playbook-engine-foundation.md` for the full architecture and
 * end-to-end flow.
 */
export function explainPlaybookEngineCapability(): PlaybookEngineCapabilityExplain {
  return {
    capability: "playbook-engine",
    purpose:
      "Codifica una metodología de delivery como reglas evaluables, de forma que el LLM opere, explique y documente " +
      "dentro del playbook en lugar de improvisar cómo gestionar el proyecto — desde la evaluación de reglas hasta " +
      "un governance snapshot demo-ready, con un rastro de auditoría explicable en cada paso.",
    scope:
      "Cubre el MVP completo: Seed Playbook (fases y reglas), Rules Engine, Project Constitution Generator, " +
      "Recommendation Engine, Communications Playbook, Operational Intelligence, Closure & Billing Intelligence, " +
      "Audit Trail y el Governance Snapshot que integra todo lo anterior en una sola evaluación end-to-end.",
    modules: [
      "Seed Playbook (fases y reglas de la metodología de delivery)",
      "Rules Engine (evaluación pura de hechos del proyecto contra el playbook)",
      "Project Constitution Generator (draft de la Constitución del Proyecto)",
      "Recommendation Engine (recomendaciones gobernadas y explicables)",
      "Communications Playbook (borradores de comunicación, nunca enviados automáticamente)",
      "Operational Intelligence (borradores de riesgo/issue/dependencia/decisión)",
      "Closure & Billing Intelligence (checklist y bloqueantes de cierre/facturación)",
      "Audit Trail (mapeo puro de eventos de auditoría, sin persistencia ni emisión real)",
      "Governance Snapshot (orquestador de integración demo-ready end-to-end)",
    ],
    limits: [
      "El playbook es estático (seed) para el MVP; el Playbook Registry editable no está implementado.",
      "Una regla nunca se evalúa como disparada o no disparada si falta evidencia: se reporta como indeterminada.",
      "Ningún módulo escribe en base de datos ni emite eventos de auditoría/platform-events reales por sí mismo.",
      "Ningún módulo envía correos ni ejecuta comunicaciones reales; todo borrador de comunicación requiere copiar/enviar manualmente.",
      "Ningún módulo cierra proyectos ni marca facturas como emitidas automáticamente.",
      "Ninguna recomendación, borrador o draft de Constitution se aprueba automáticamente; toda acción sensible queda marcada con `approvalRequired`.",
      "El Governance Snapshot es un artefacto de solo lectura para demo; materializarlo (persistencia, Playbook Registry, integración de Gmail, portfolio intelligence) queda fuera de este MVP.",
    ],
    phases: SEED_DELIVERY_PLAYBOOK.phases.map((phase) => phase.key),
    ruleCount: SEED_DELIVERY_PLAYBOOK.rules.length,
    governingPrinciples: [
      "Toda evaluación debe explicar qué regla la activó.",
      "Toda evaluación debe mostrar evidencia usada y evidencia faltante.",
      "Si falta información, no se inventa: la regla queda indeterminada.",
      "Ninguna acción sensible se ejecuta sola: siempre existe un punto de aprobación humana explícito.",
    ],
  };
}
