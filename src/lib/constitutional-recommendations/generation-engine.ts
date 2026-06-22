// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Generation Engine
// Converts Learning Patterns into actionable recommendations via templates.
// Sovereignty Principle 1: Every recommendation must originate from verifiable learning.
// Sovereignty Principle 3: No opaque recommendations.
// ─────────────────────────────────────────────────────────────────────────────

import type { RecommendationType, RecommendationScope } from "./types";

export type GeneratedRecommendationTemplate = {
  recommendationType: RecommendationType;
  recommendationScope: RecommendationScope;
  title: string;
  description: string;
  recommendationText: string;
  baseConfidence: number;
};

// ─── Template catalog ─────────────────────────────────────────────────────────
// Maps patternType::patternKey to a recommendation template.
// Each entry is directly traceable to the learning pattern that inspired it.

const TEMPLATE_CATALOG: Record<string, GeneratedRecommendationTemplate> = {
  // ── Risk patterns ──────────────────────────────────────────────────────────
  "risk_pattern::third_party_dependency": {
    recommendationType: "risk_mitigation",
    recommendationScope: "risk",
    title: "Vendor Readiness Assessment",
    description: "Recurring third-party dependency risk detected across multiple projects.",
    recommendationText:
      "Establecer evaluación formal de readiness del proveedor antes de comprometer fechas. " +
      "Validar capacidad de entrega y obligaciones contractuales previo a la aprobación del cronograma.",
    baseConfidence: 0.82,
  },
  "risk_pattern::approval_delay": {
    recommendationType: "ratification_control",
    recommendationScope: "ratification",
    title: "Early Ratification Checkpoint",
    description: "Recurring approval delay pattern detected across projects.",
    recommendationText:
      "Introducir ratificación temprana y responsables explícitos de aprobación. " +
      "Identificar autoridades de aprobación antes del inicio del proyecto y pre-agendar ventanas de firma.",
    baseConfidence: 0.79,
  },
  "risk_pattern::resource_shortage": {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Capacity Validation Before Commitment",
    description: "Resource shortage detected as a recurring delivery risk.",
    recommendationText:
      "Validar capacidad operativa antes de aprobar cronogramas. " +
      "Identificar restricciones de recursos y establecer rutas de escalación para brechas de dotación.",
    baseConfidence: 0.76,
  },
  "risk_pattern::technical_complexity": {
    recommendationType: "decision_guidance",
    recommendationScope: "decision",
    title: "Technical Feasibility Review",
    description: "High technical complexity pattern recurs across project commitments.",
    recommendationText:
      "Requerir revisión de factibilidad técnica antes del compromiso. " +
      "Descomponer entregables complejos y validar supuestos con expertos en la materia.",
    baseConfidence: 0.74,
  },
  "risk_pattern::regulatory_compliance": {
    recommendationType: "governance_control",
    recommendationScope: "governance",
    title: "Compliance Review at Inception",
    description: "Regulatory compliance risk appears consistently at project initiation.",
    recommendationText:
      "Involucrar revisión de cumplimiento desde el inicio del proyecto. " +
      "Mapear requerimientos regulatorios a entregables y asignar responsabilidad tempranamente.",
    baseConfidence: 0.78,
  },
  "risk_pattern::budget_overrun": {
    recommendationType: "governance_control",
    recommendationScope: "delivery",
    title: "Budget Checkpoint Gates",
    description: "Budget overrun is a recurring outcome pattern across projects.",
    recommendationText:
      "Establecer puntos de control de presupuesto en hitos de etapa. " +
      "Definir umbrales de contingencia y disparadores de escalación antes del inicio del proyecto.",
    baseConfidence: 0.75,
  },
  "risk_pattern::scope_creep": {
    recommendationType: "governance_control",
    recommendationScope: "governance",
    title: "Scope Freeze and Change Control",
    description: "Scope creep detected as a recurring governance failure.",
    recommendationText:
      "Definir y congelar el alcance en la iniciación del proyecto. " +
      "Implementar control de cambios formal y requerir aprobación de autoridad para adiciones de alcance.",
    baseConfidence: 0.77,
  },
  // ── Governance patterns ────────────────────────────────────────────────────
  "governance_pattern::authority_gap": {
    recommendationType: "authority_control",
    recommendationScope: "authority",
    title: "Authority Mapping Before Execution",
    description: "Authority gap detected as a recurring governance failure.",
    recommendationText:
      "Conducir mapeo de autoridad antes del inicio del proyecto. " +
      "Identificar todas las categorías de decisión y asignar autoridades responsables. " +
      "Definir delegaciones formales antes de la ejecución.",
    baseConfidence: 0.81,
  },
  "governance_pattern::late_escalation": {
    recommendationType: "governance_control",
    recommendationScope: "governance",
    title: "Automatic Escalation Thresholds",
    description: "Late escalation is a recurring governance failure pattern.",
    recommendationText:
      "Establecer umbrales automáticos de escalación. " +
      "Definir disparadores de escalación y límites de tiempo al inicio del proyecto para prevenir bloqueos críticos.",
    baseConfidence: 0.78,
  },
  "governance_pattern::approval_bottleneck": {
    recommendationType: "ratification_control",
    recommendationScope: "ratification",
    title: "Approval Bottleneck Risk Mapping",
    description: "Approval bottleneck detected as a recurring ratification failure.",
    recommendationText:
      "Identificar riesgo de cuello de botella en aprobaciones mapeando disponibilidad del aprobador " +
      "contra el cronograma del proyecto antes del compromiso.",
    baseConfidence: 0.76,
  },
  "governance_pattern::decision_reversal": {
    recommendationType: "decision_guidance",
    recommendationScope: "decision",
    title: "Pre-Ratification for Major Decisions",
    description: "Decision reversal pattern detected across governance records.",
    recommendationText:
      "Requerir ratificación antes de implementar decisiones mayores. " +
      "Documentar condiciones de reversión y umbrales de autoridad de antemano.",
    baseConfidence: 0.74,
  },
  // ── Decision patterns ──────────────────────────────────────────────────────
  "decision_pattern::vendor_replacement": {
    recommendationType: "decision_guidance",
    recommendationScope: "decision",
    title: "Vendor Transition Planning",
    description: "Vendor replacement decisions recur without structured transition plans.",
    recommendationText:
      "Introducir planificación de transición de proveedor antes de las decisiones de reemplazo. " +
      "Documentar criterios de handover y requerimientos de continuidad.",
    baseConfidence: 0.80,
  },
  "decision_pattern::schedule_change": {
    recommendationType: "decision_guidance",
    recommendationScope: "delivery",
    title: "Schedule Change Impact Assessment",
    description: "Schedule change decisions are consistently made without downstream impact analysis.",
    recommendationText:
      "Requerir evaluación de impacto antes de aprobar cambios de cronograma. " +
      "Cuantificar efectos en dependencias y hitos.",
    baseConfidence: 0.73,
  },
  "decision_pattern::approval_required": {
    recommendationType: "authority_control",
    recommendationScope: "authority",
    title: "Pre-Delegated Routine Approvals",
    description: "Approval bottlenecks detected in decision routing.",
    recommendationText:
      "Mapear autoridad de aprobación a categorías de decisión con anticipación. " +
      "Prevenir cuellos de botella pre-delegando aprobaciones rutinarias.",
    baseConfidence: 0.75,
  },
  "decision_pattern::budget_adjustment": {
    recommendationType: "governance_control",
    recommendationScope: "governance",
    title: "Budget Adjustment Thresholds",
    description: "Budget adjustments recur without defined approval chains.",
    recommendationText:
      "Definir umbrales de ajuste de presupuesto y cadenas de aprobación al inicio del proyecto. " +
      "Requerir documentación de justificación para todos los ajustes.",
    baseConfidence: 0.72,
  },
  "decision_pattern::resource_reallocation": {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Resource Reallocation Impact Documentation",
    description: "Resource reallocation decisions are made without viability checks.",
    recommendationText:
      "Documentar impacto de reasignación de recursos antes de ejecutar. " +
      "Validar que los flujos de origen y destino permanezcan viables.",
    baseConfidence: 0.70,
  },
  // ── Outcome patterns ───────────────────────────────────────────────────────
  "outcome_pattern::delivery_delay": {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Delivery Risk Monitoring",
    description: "Delivery delay is a recurring outcome across the portfolio.",
    recommendationText:
      "Establecer indicadores de riesgo de entrega y monitorearlos semanalmente. " +
      "Definir umbrales de demora que disparen escalación automática.",
    baseConfidence: 0.77,
  },
  "outcome_pattern::cost_overrun": {
    recommendationType: "governance_control",
    recommendationScope: "delivery",
    title: "Leading Financial Indicators",
    description: "Cost overrun detected as a recurring outcome pattern.",
    recommendationText:
      "Implementar seguimiento financiero con indicadores adelantados. " +
      "Definir umbrales de velocidad de gasto que disparen revisión antes de que ocurra la sobrecosto.",
    baseConfidence: 0.75,
  },
  "outcome_pattern::cancelled": {
    recommendationType: "decision_guidance",
    recommendationScope: "project",
    title: "Viability Criteria and Go/No-Go Gates",
    description: "Project cancellation pattern detected across the portfolio.",
    recommendationText:
      "Definir criterios de viabilidad en la iniciación del proyecto. " +
      "Realizar revisiones periódicas de go/no-go en hitos de etapa para permitir cancelación temprana.",
    baseConfidence: 0.72,
  },
  // ── Delivery patterns ──────────────────────────────────────────────────────
  "delivery_pattern::milestone_slip": {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Milestone Slip Early Warning",
    description: "Milestone slip is a recurring delivery failure.",
    recommendationText:
      "Implementar alertas tempranas de deslizamiento de hitos. " +
      "Definir indicadores adelantados por hito y revisar semanalmente.",
    baseConfidence: 0.76,
  },
  // ── Amendment patterns ─────────────────────────────────────────────────────
  "amendment_pattern::unratified_change": {
    recommendationType: "amendment_guidance",
    recommendationScope: "amendment",
    title: "Amendment Ratification Protocol",
    description: "Unratified constitutional amendments detected as a recurring pattern.",
    recommendationText:
      "Crear protocolo estándar de enmienda. " +
      "Definir cadenas de aprobación, requerimientos de documentación y pasos de ratificación.",
    baseConfidence: 0.73,
  },
  // ── Authority patterns ─────────────────────────────────────────────────────
  "authority_pattern::delegation_gap": {
    recommendationType: "authority_control",
    recommendationScope: "authority",
    title: "Delegation Rules Before Execution",
    description: "Authority delegation gaps detected across project governance.",
    recommendationText:
      "Clarificar límites de autoridad para este patrón. " +
      "Establecer reglas de delegación y procedimientos de resolución de conflictos de antemano.",
    baseConfidence: 0.74,
  },
};

// ─── Fallback templates by pattern type ───────────────────────────────────────

const FALLBACK_TEMPLATES: Record<string, Omit<GeneratedRecommendationTemplate, "baseConfidence">> = {
  risk_pattern: {
    recommendationType: "risk_mitigation",
    recommendationScope: "risk",
    title: "Risk Mitigation Playbook",
    description: "Recurring risk pattern requires a standard mitigation protocol.",
    recommendationText:
      "Desarrollar un manual de mitigación de riesgos para este patrón. " +
      "Definir pasos estándar de mitigación y asignar responsabilidad antes de que el riesgo se materialice.",
  },
  governance_pattern: {
    recommendationType: "governance_control",
    recommendationScope: "governance",
    title: "Governance Control Strengthening",
    description: "Recurring governance pattern requires strengthened controls.",
    recommendationText:
      "Fortalecer controles de gobernanza para este patrón. " +
      "Definir accountability, rutas de escalación y cadencias de revisión de forma proactiva.",
  },
  decision_pattern: {
    recommendationType: "decision_guidance",
    recommendationScope: "decision",
    title: "Decision Framework Documentation",
    description: "Recurring decision pattern lacks a standard framework.",
    recommendationText:
      "Documentar criterios de decisión y requerimientos de autoridad antes de que este patrón se repita. " +
      "Establecer un framework de decisión estándar para esta categoría.",
  },
  authority_pattern: {
    recommendationType: "authority_control",
    recommendationScope: "authority",
    title: "Authority Boundary Clarification",
    description: "Authority boundary gaps detected in this pattern.",
    recommendationText:
      "Clarificar límites de autoridad para este patrón. " +
      "Establecer reglas de delegación y procedimientos de resolución de conflictos de antemano.",
  },
  amendment_pattern: {
    recommendationType: "amendment_guidance",
    recommendationScope: "amendment",
    title: "Amendment Protocol Definition",
    description: "Amendment pattern lacks a standard protocol.",
    recommendationText:
      "Crear un protocolo estándar de enmienda para este patrón. " +
      "Definir cadenas de aprobación, requerimientos de documentación y pasos de ratificación.",
  },
  delivery_pattern: {
    recommendationType: "delivery_improvement",
    recommendationScope: "delivery",
    title: "Delivery Checkpoint and Criteria",
    description: "Recurring delivery pattern requires checkpoints and success criteria.",
    recommendationText:
      "Establecer puntos de control de entrega y criterios de éxito para este patrón. " +
      "Definir criterios de aceptación y procedimientos de validación.",
  },
  outcome_pattern: {
    recommendationType: "delivery_improvement",
    recommendationScope: "project",
    title: "Outcome Monitoring and Criteria",
    description: "Recurring outcome pattern requires explicit success and failure criteria.",
    recommendationText:
      "Definir criterios de éxito y fracaso para este patrón antes del compromiso del proyecto. " +
      "Incorporar monitoreo en la gobernanza del proyecto.",
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getRecommendationTemplate(
  patternType: string,
  patternKey: string,
  patternConfidence: number,
): GeneratedRecommendationTemplate & { recommendationKey: string } {
  const catalogKey = `${patternType}::${patternKey}`;
  const template = TEMPLATE_CATALOG[catalogKey];

  if (template) {
    const blended = round3((template.baseConfidence + patternConfidence) / 2);
    return { ...template, baseConfidence: blended, recommendationKey: catalogKey };
  }

  const fallback = FALLBACK_TEMPLATES[patternType] ?? FALLBACK_TEMPLATES["outcome_pattern"];
  return {
    ...fallback,
    baseConfidence: round3(Math.min(0.6, patternConfidence * 0.8)),
    recommendationKey: catalogKey,
  };
}

export function getAllTemplateKeys(): string[] {
  return Object.keys(TEMPLATE_CATALOG);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
