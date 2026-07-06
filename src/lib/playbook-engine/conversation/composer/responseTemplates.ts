import type { MissingContextItem } from "../types";

/** Human-readable, Spanish-first labels for each `MissingContextItem` — used when the composer
 * lists what's still missing instead of silently guessing it. */
export const MISSING_CONTEXT_LABELS: Record<MissingContextItem, string> = {
  project: "un proyecto activo identificado",
  stakeholder: "a quién va dirigido (stakeholder)",
  last_communication: "la última comunicación registrada",
  blocked_milestone: "qué hito o entregable está bloqueado",
  due_date: "una fecha límite",
  decision_owner: "quién debe tomar la decisión",
  acceptance_status: "el estado de aceptación/validación del cliente",
  billing_status: "el estado de facturación (OC, aprobación interna, factura)",
  risk_evidence: "evidencia registrada (riesgos, evidencia técnica)",
  requested_output: "qué tipo de entregable necesitas (correo, reporte, etc.)",
};

export function formatMissingContextNote(missingContext: MissingContextItem[]): string | null {
  if (missingContext.length === 0) return null;
  const labels = missingContext.map((item) => MISSING_CONTEXT_LABELS[item]);
  return `Para darte algo más preciso me ayudaría tener: ${labels.join("; ")}.`;
}

/** The governed sentence PMFreak repeats whenever a response touches a sensitive action —
 * mirrors the "never executes automatically" narrative every Playbook Engine sprint carries. */
export const APPROVAL_REQUIRED_NOTE =
  "Esto no se ejecuta automáticamente: requiere tu revisión y aprobación antes de convertirse en una acción real.";

export const UNSUPPORTED_REDIRECT =
  "Esa pregunta está fuera de lo que PMFreak cubre. Soy tu copiloto de gestión de proyectos: puedo ayudarte con estado de proyecto, riesgos, comunicaciones, cierre, facturación, gobernanza y recomendaciones. ¿En qué de eso te ayudo?";

export const NO_EVIDENCE_DISCLAIMER =
  "No voy a asumir evidencia que no tengo — esto es orientación general hasta que conectemos datos reales del proyecto.";
