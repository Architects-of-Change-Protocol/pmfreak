import type { CommunicationTemplate, CommunicationTemplateId, CommunicationTemplateInputContext } from "./communication-types";

const MISSING_INPUT_LABELS: Record<string, string> = {
  recipients: "destinatario(s) del cliente",
  meetingDate: "fecha de la reunión",
  attendees: "lista de asistentes",
  decisionsMade: "decisiones tomadas",
  decisionNeeded: "descripción de la decisión requerida",
  decisionOwner: "responsable de tomar la decisión",
  decisionDeadline: "fecha límite de la decisión",
  billingContactName: "contacto de facturación",
  scopeChangeSummary: "resumen del cambio de alcance",
  requestedInformation: "lista de información solicitada",
};

function placeholder(inputKey: string): string {
  return `[PENDIENTE: ${MISSING_INPUT_LABELS[inputKey] ?? inputKey}]`;
}

function greeting(ctx: CommunicationTemplateInputContext): string {
  const names = ctx.recipients.map((r) => r.name).filter((n): n is string => Boolean(n && n.trim()));
  return names.length > 0 ? names.join(", ") : placeholder("recipients");
}

function projectLabel(ctx: CommunicationTemplateInputContext): string {
  return ctx.projectContext.projectName?.trim() || "el proyecto";
}

function requestedInformationList(ctx: CommunicationTemplateInputContext): string[] {
  const explicit = ctx.projectContext.additionalInputs?.requestedInformation ?? [];
  if (explicit.length > 0) return explicit;
  return ctx.recommendation.missingEvidence;
}

/**
 * Seed library of Communications Playbook templates. Each generator is a pure function of
 * the recommendation/context — never invents recipients or facts, and every field it cannot
 * derive is rendered as an explicit `[PENDIENTE: ...]` placeholder that also surfaces in
 * `missingInputs` (see `communication-draft-engine.ts`).
 */
export const COMMUNICATION_TEMPLATES: Readonly<Record<CommunicationTemplateId, CommunicationTemplate>> = {
  soft_follow_up: {
    id: "soft_follow_up",
    name: "Seguimiento suave",
    purpose: "follow_up",
    tone: "soft",
    channel: "email",
    applicableRecommendationTypes: ["client_no_response_low_medium"],
    requiredInputs: ["recipients"],
    approvalRequired: false,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Seguimiento: ${ctx.recommendation.title} — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => [
      `Hola ${greeting(ctx)},`,
      "",
      `Quería hacer un breve seguimiento sobre ${projectLabel(ctx)}: ${ctx.recommendation.detectedSituation}`,
      `${ctx.recommendation.recommendedAction}`,
      "",
      "Quedo atento a cualquier novedad de tu parte, sin ninguna urgencia particular.",
      "",
      "Saludos.",
    ].join("\n"),
  },

  formal_follow_up: {
    id: "formal_follow_up",
    name: "Seguimiento formal",
    purpose: "follow_up",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["client_no_response_high", "fallback_default"],
    requiredInputs: ["recipients"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Seguimiento requerido: ${ctx.recommendation.title} — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => [
      `Estimado(a) ${greeting(ctx)},`,
      "",
      `Le escribimos para dar seguimiento formal a lo siguiente en ${projectLabel(ctx)}: ${ctx.recommendation.detectedSituation}`,
      `Acción requerida: ${ctx.recommendation.recommendedAction}`,
      "",
      "Agradecemos su respuesta a la brevedad para evitar impacto en el cronograma del proyecto.",
      "",
      "Saludos cordiales.",
    ].join("\n"),
  },

  reception_request: {
    id: "reception_request",
    name: "Solicitud de recepción / sign-off",
    purpose: "reception_request",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["reception_or_signoff_pending"],
    requiredInputs: ["recipients"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Solicitud de recepción / sign-off — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => [
      `Estimado(a) ${greeting(ctx)},`,
      "",
      `Solicitamos su confirmación formal de recepción/sign-off para ${projectLabel(ctx)}: ${ctx.recommendation.detectedSituation}`,
      `${ctx.recommendation.recommendedAction}`,
      "",
      "Quedamos atentos a su confirmación por este medio.",
      "",
      "Saludos cordiales.",
    ].join("\n"),
  },

  billing_enablement_follow_up: {
    id: "billing_enablement_follow_up",
    name: "Seguimiento de habilitación de facturación",
    purpose: "billing_enablement",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["billing_blocked"],
    requiredInputs: ["recipients"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Habilitación de facturación pendiente — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => {
      const billingContact = ctx.projectContext.additionalInputs?.billingContactName?.trim() || placeholder("billingContactName");
      return [
        `Estimado(a) ${greeting(ctx)},`,
        "",
        `Necesitamos su ayuda para destrabar la facturación de ${projectLabel(ctx)}: ${ctx.recommendation.detectedSituation}`,
        `${ctx.recommendation.recommendedAction}`,
        `Contacto de facturación sugerido: ${billingContact}`,
        "",
        "Agradecemos confirmar los datos o pasos pendientes para poder emitir/cobrar la factura.",
        "",
        "Saludos cordiales.",
      ].join("\n");
    },
  },

  soft_escalation: {
    id: "soft_escalation",
    name: "Escalación suave",
    purpose: "escalation",
    tone: "soft",
    channel: "email",
    applicableRecommendationTypes: ["client_no_response_critical"],
    requiredInputs: ["recipients"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Necesitamos su atención: ${ctx.recommendation.title} — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => [
      `Hola ${greeting(ctx)},`,
      "",
      `Nos gustaría escalar de forma preventiva lo siguiente en ${projectLabel(ctx)}, dado el impacto potencial: ${ctx.recommendation.detectedSituation}`,
      `${ctx.recommendation.recommendedAction}`,
      "",
      "¿Podríamos coordinar una breve llamada esta semana para resolverlo juntos?",
      "",
      "Saludos.",
    ].join("\n"),
  },

  formal_escalation: {
    id: "formal_escalation",
    name: "Escalación formal",
    purpose: "escalation",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["client_no_response_critical", "manual_override"],
    requiredInputs: ["recipients"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Escalación formal: ${ctx.recommendation.title} — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => [
      `Estimado(a) ${greeting(ctx)},`,
      "",
      `Escalamos formalmente la siguiente situación en ${projectLabel(ctx)} por su severidad (${ctx.recommendation.severity}): ${ctx.recommendation.detectedSituation}`,
      `Acción requerida: ${ctx.recommendation.recommendedAction}`,
      "",
      "Solicitamos una respuesta o reunión de resolución a la brevedad posible.",
      "",
      "Saludos cordiales.",
    ].join("\n"),
  },

  meeting_minutes: {
    id: "meeting_minutes",
    name: "Minuta de reunión",
    purpose: "meeting_minutes",
    tone: "neutral",
    channel: "meeting_minutes",
    applicableRecommendationTypes: ["any"],
    requiredInputs: ["meetingDate", "attendees", "decisionsMade"],
    approvalRequired: false,
    externalSendRequiresApproval: true,
    bodyGenerator: (ctx) => {
      const additional = ctx.projectContext.additionalInputs ?? {};
      const meetingDate = additional.meetingDate?.trim() || placeholder("meetingDate");
      const attendees = additional.attendees?.length ? additional.attendees.join(", ") : placeholder("attendees");
      const decisions = additional.decisionsMade?.length ? additional.decisionsMade.map((d) => `- ${d}`).join("\n") : `- ${placeholder("decisionsMade")}`;
      return [
        `Minuta de reunión — ${projectLabel(ctx)}`,
        `Fecha: ${meetingDate}`,
        `Asistentes: ${attendees}`,
        "",
        `Contexto (playbook): ${ctx.recommendation.detectedSituation}`,
        `Acción relacionada: ${ctx.recommendation.recommendedAction}`,
        "",
        "Decisiones/acuerdos:",
        decisions,
      ].join("\n");
    },
  },

  decision_request: {
    id: "decision_request",
    name: "Solicitud de decisión",
    purpose: "decision_request",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["decision_pending_or_unowned"],
    requiredInputs: ["recipients", "decisionNeeded", "decisionOwner", "decisionDeadline"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Decisión requerida: ${ctx.recommendation.title} — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => {
      const additional = ctx.projectContext.additionalInputs ?? {};
      const decisionNeeded = additional.decisionNeeded?.trim() || placeholder("decisionNeeded");
      const decisionOwner = additional.decisionOwner?.trim() || placeholder("decisionOwner");
      const decisionDeadline = additional.decisionDeadline?.trim() || placeholder("decisionDeadline");
      return [
        `Estimado(a) ${greeting(ctx)},`,
        "",
        `Se requiere una decisión en ${projectLabel(ctx)}: ${ctx.recommendation.detectedSituation}`,
        `Decisión requerida: ${decisionNeeded}`,
        `Responsable propuesto: ${decisionOwner}`,
        `Fecha límite: ${decisionDeadline}`,
        "",
        "Agradecemos confirmar la decisión o indicar quién debe tomarla.",
        "",
        "Saludos cordiales.",
      ].join("\n");
    },
  },

  information_request: {
    id: "information_request",
    name: "Solicitud de información",
    purpose: "information_request",
    tone: "neutral",
    channel: "email",
    applicableRecommendationTypes: ["missing_artifact_or_evidence"],
    requiredInputs: ["recipients", "requestedInformation"],
    approvalRequired: false,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Solicitud de información: ${ctx.recommendation.title} — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => {
      const items = requestedInformationList(ctx);
      const itemsBlock = items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : `- ${placeholder("requestedInformation")}`;
      return [
        `Hola ${greeting(ctx)},`,
        "",
        `Para avanzar en ${projectLabel(ctx)} necesitamos la siguiente información: ${ctx.recommendation.detectedSituation}`,
        "",
        "Información solicitada:",
        itemsBlock,
        "",
        "Quedamos atentos, gracias.",
      ].join("\n");
    },
  },

  closure_confirmation: {
    id: "closure_confirmation",
    name: "Confirmación de cierre",
    purpose: "closure_confirmation",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["closure_ready"],
    requiredInputs: ["recipients"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Confirmación de cierre — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => {
      const summary = ctx.projectContext.additionalInputs?.closureSummary?.trim() || placeholder("closureSummary");
      return [
        `Estimado(a) ${greeting(ctx)},`,
        "",
        `${projectLabel(ctx)} cumple las condiciones de cierre registradas por el playbook: ${ctx.recommendation.detectedSituation}`,
        `Resumen de cierre: ${summary}`,
        "",
        "Solicitamos su confirmación formal para proceder con el cierre del proyecto.",
        "",
        "Saludos cordiales.",
      ].join("\n");
    },
  },

  scope_change_notice: {
    id: "scope_change_notice",
    name: "Aviso de cambio de alcance",
    purpose: "scope_change_notice",
    tone: "formal",
    channel: "email",
    applicableRecommendationTypes: ["possible_scope_change"],
    requiredInputs: ["recipients", "scopeChangeSummary"],
    approvalRequired: true,
    externalSendRequiresApproval: true,
    subjectGenerator: (ctx) => `Aviso de posible cambio de alcance — ${projectLabel(ctx)}`,
    bodyGenerator: (ctx) => {
      const summary = ctx.projectContext.additionalInputs?.scopeChangeSummary?.trim() || placeholder("scopeChangeSummary");
      return [
        `Estimado(a) ${greeting(ctx)},`,
        "",
        `Identificamos un posible cambio de alcance en ${projectLabel(ctx)}: ${ctx.recommendation.detectedSituation}`,
        `Resumen del cambio: ${summary}`,
        `${ctx.recommendation.recommendedAction}`,
        "",
        "Este aviso no constituye una aprobación de cambio; requiere su revisión y confirmación formal.",
        "",
        "Saludos cordiales.",
      ].join("\n");
    },
  },
};
