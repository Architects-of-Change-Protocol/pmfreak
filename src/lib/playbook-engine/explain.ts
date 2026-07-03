import { SEED_DELIVERY_PLAYBOOK } from "./seed-playbook";

export type PlaybookEngineCapabilityExplain = {
  capability: string;
  purpose: string;
  scope: string;
  limits: string[];
  phases: string[];
  ruleCount: number;
  governingPrinciples: string[];
};

export function explainPlaybookEngineCapability(): PlaybookEngineCapabilityExplain {
  return {
    capability: "playbook-engine",
    purpose:
      "Codifica una metodología de delivery como reglas evaluables, de forma que el LLM opere, explique y documente " +
      "dentro del playbook en lugar de improvisar cómo gestionar el proyecto.",
    scope:
      "Cubre el seed playbook (fases y reglas), y el motor de reglas puro que evalúa hechos del proyecto contra esas " +
      "reglas. No persiste datos, no genera recomendaciones gobernadas ni toma acciones — eso corresponde a los " +
      "módulos de Recommendation Engine, Communications Playbook y Closure & Billing Intelligence.",
    limits: [
      "El playbook es estático (seed) para el MVP; el Playbook Registry editable no está implementado.",
      "Una regla nunca se evalúa como disparada o no disparada si falta evidencia: se reporta como indeterminada.",
      "El motor no escribe en base de datos ni emite eventos de auditoría por sí mismo.",
      "No decide ni ejecuta acciones; solo produce evaluaciones de reglas con evidencia usada y faltante.",
    ],
    phases: SEED_DELIVERY_PLAYBOOK.phases.map((phase) => phase.key),
    ruleCount: SEED_DELIVERY_PLAYBOOK.rules.length,
    governingPrinciples: [
      "Toda evaluación debe explicar qué regla la activó.",
      "Toda evaluación debe mostrar evidencia usada y evidencia faltante.",
      "Si falta información, no se inventa: la regla queda indeterminada.",
    ],
  };
}
