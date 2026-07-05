import { createHash } from "node:crypto";

import type { PlaybookEngineResult } from "./types";
import type { PlaybookRecommendation } from "./recommendation-engine";
import type {
  DependencyDraft,
  DependencyDraftType,
  DecisionDraft,
  IssueDraft,
  OperationalDraft,
  OperationalDraftExplanation,
  OperationalIntelligenceProjectContext,
  RiskDraft,
  RiskDraftCategory,
} from "./operational-intelligence-types";

const SCOPE_CHANGE_PATTERN = /cambio de alcance|scope change/i;
const RECEPTION_PATTERN = /recepci[oó]n|sign[- ]?off/i;
const TECHNICALLY_COMPLETE_PATTERN = /t[eé]cnicamente completo|completado t[eé]cnicamente/i;
const BILLING_OR_CLOSURE_PATTERN = /facturaci[oó]n|billing|invoice/i;
const CLIENT_NO_RESPONSE_PATTERN = /sin respuesta|no ha respondido|no responde/i;
const DECISION_GENERIC_PATTERN = /decisi[oó]n/i;
const ACCEPTANCE_CRITERIA_PATTERN = /criterios? de aceptaci[oó]n|acceptance criteria/i;
const MILESTONE_OVERDUE_PATTERN = /hito.*(venc|atras)|milestone.*overdue/i;
const MISSING_DELIVERABLE_EVIDENCE_PATTERN = /entregable/i;
const RISK_GENERIC_PATTERN = /riesgo/i;
const DEPENDENCY_GENERIC_PATTERN = /dependenc/i;
const EXTERNAL_PARTY_PATTERN = /cliente|proveedor|externo|vendor|provider/i;

/**
 * A classification decision: which operational draft type(s) a recommendation warrants, and
 * why. Never a promise that any object will actually be created — see governing principle in
 * the module docstring below.
 */
export type OperationalDraftBlueprint =
  | { type: "risk"; category: RiskDraftCategory; escalationRecommended: boolean; reason: string }
  | { type: "issue"; blocking: boolean; reason: string }
  | { type: "dependency"; dependencyType: DependencyDraftType; reason: string }
  | { type: "decision"; reason: string };

/**
 * Suggested actions that mean "the fired rule already asks for a specific artifact to be
 * (re)generated" rather than "here's a real-world risk/issue/dependency/decision to track."
 * A recommendation carrying one of these must never also spawn an operational draft — e.g.
 * `generate_project_constitution_draft` is a governed drafting action with its own module
 * (`constitution-generator.ts`); classifying it as a "decision" draft too (which the text-only
 * regex path below used to do, since the rule's own text happens to mention "decisiones
 * futuras") would be a category error, not a real operational item.
 */
const NON_OPERATIONAL_SUGGESTED_ACTIONS = new Set<string>(["generate_project_constitution_draft"]);

/**
 * Structured-data-first classification for the known seed playbook rules (`seed-playbook.ts`).
 * Keyed by the stable `playbookRuleId` rather than derived from rule prose, so a future copy-edit
 * to a rule's title/description/recommendationTemplate can never silently change which operational
 * draft(s) it produces. Values are factories (not static blueprints) so fields that legitimately
 * depend on the recommendation's own severity (e.g. `escalationRecommended`) stay correct even if
 * a rule's severity changes later without its id changing. Every entry here reproduces exactly
 * what the text/severity fallback below already resolves for that rule id today — this is a pure
 * robustness refactor, not a behavior change, with one deliberate exception documented at the
 * `NON_OPERATIONAL_SUGGESTED_ACTIONS` guard above. Recommendations whose `playbookRuleId` isn't
 * listed here (a custom/manual recommendation, or a future Playbook Registry rule) fall through to
 * the text/severity classification unchanged.
 */
const RULE_ID_OPERATIONAL_DRAFT_BLUEPRINTS: Partial<
  Record<string, (recommendation: PlaybookRecommendation) => OperationalDraftBlueprint[]>
> = {
  "pb-plan-risk-register-missing": (recommendation) => [
    {
      type: "risk",
      category: "internal",
      escalationRecommended: recommendation.severity === "critical",
      reason: "La regla detectó un riesgo de severidad alta/crítica sin mitigación registrada.",
    },
  ],
  "pb-exec-critical-risks-open": (recommendation) => [
    {
      type: "risk",
      category: "internal",
      escalationRecommended: recommendation.severity === "critical",
      reason: "La regla detectó un riesgo de severidad alta/crítica sin mitigación registrada.",
    },
  ],
  "pb-close-signoff-missing": () => [
    {
      type: "dependency",
      dependencyType: "client",
      reason: "La recepción/sign-off del cliente es una dependencia externa no resuelta.",
    },
  ],
};

function recommendationText(recommendation: PlaybookRecommendation): string {
  return [
    recommendation.playbookRuleId,
    recommendation.title,
    recommendation.detectedSituation,
    recommendation.recommendedAction,
  ].join(" ");
}

function detectDependencyType(text: string): DependencyDraftType {
  if (/cliente/i.test(text)) return "client";
  if (/proveedor|vendor|provider/i.test(text)) return "provider";
  if (/contractual|contrato/i.test(text)) return "contractual";
  if (/comercial|facturaci[oó]n|billing|invoice/i.test(text)) return "commercial";
  if (/t[eé]cnic/i.test(text)) return "technical";
  return "internal";
}

function detectRiskCategory(text: string): RiskDraftCategory {
  if (/cliente/i.test(text)) return "client";
  if (/proveedor|vendor|provider/i.test(text)) return "provider";
  if (/contractual|contrato/i.test(text)) return "contractual";
  if (/financ|presupuest|budget/i.test(text)) return "financial";
  if (/comercial/i.test(text)) return "commercial";
  if (/reputaci[oó]n|reputation/i.test(text)) return "reputational";
  if (/log[ií]stic/i.test(text)) return "logistics";
  if (/t[eé]cnic/i.test(text)) return "technical";
  return "internal";
}

/**
 * Classifies a governed `PlaybookRecommendation` (Sprint 3) into zero or more operational draft
 * blueprints (risk/issue/dependency/decision). Structured data first: a recommendation whose fired
 * rule already suggests a non-operational artifact action (`NON_OPERATIONAL_SUGGESTED_ACTIONS`)
 * never produces a draft, and a recommendation from a known seed rule id resolves via
 * `RULE_ID_OPERATIONAL_DRAFT_BLUEPRINTS`. Text/severity classification remains only as the
 * fallback for recommendations that don't match either of those — mirrors
 * `selectCommunicationTemplateForRecommendation` (Sprint 4). Unlike that function, this one may
 * legitimately return an empty array: not every recommendation warrants an operational object
 * proposal (e.g. "missing constitution" does not).
 */
export function selectOperationalDraftTypesForRecommendation(
  recommendation: PlaybookRecommendation,
): OperationalDraftBlueprint[] {
  if (recommendation.suggestedActions.some((action) => NON_OPERATIONAL_SUGGESTED_ACTIONS.has(action.action))) {
    return [];
  }

  const knownBlueprints = RULE_ID_OPERATIONAL_DRAFT_BLUEPRINTS[recommendation.playbookRuleId];
  if (knownBlueprints) return knownBlueprints(recommendation);

  const text = recommendationText(recommendation);
  const isSevere = recommendation.severity === "high" || recommendation.severity === "critical";

  if (SCOPE_CHANGE_PATTERN.test(text)) {
    const category: RiskDraftCategory = /comercial/i.test(text) ? "commercial" : "contractual";
    return [
      { type: "decision", reason: "Un posible cambio de alcance requiere una decisión explícita del proyecto sobre cómo proceder." },
      {
        type: "risk",
        category,
        escalationRecommended: isSevere,
        reason: "Un cambio de alcance conlleva riesgo contractual/comercial hasta que se decida formalmente.",
      },
    ];
  }

  if (RECEPTION_PATTERN.test(text)) {
    const blueprints: OperationalDraftBlueprint[] = [
      { type: "dependency", dependencyType: "client", reason: "La recepción/sign-off del cliente es una dependencia externa no resuelta." },
    ];
    if (TECHNICALLY_COMPLETE_PATTERN.test(text) || BILLING_OR_CLOSURE_PATTERN.test(text)) {
      blueprints.push({
        type: "issue",
        blocking: true,
        reason: "La recepción pendiente bloquea el cierre comercial/financiero (facturación) del proyecto.",
      });
    }
    return blueprints;
  }

  if (CLIENT_NO_RESPONSE_PATTERN.test(text)) {
    const blueprints: OperationalDraftBlueprint[] = [
      { type: "dependency", dependencyType: "client", reason: "El cliente no ha respondido; esto es una dependencia externa abierta." },
    ];
    if (BILLING_OR_CLOSURE_PATTERN.test(text)) {
      blueprints.push({
        type: "issue",
        blocking: true,
        reason: "La falta de respuesta del cliente bloquea el cierre o la facturación del proyecto.",
      });
    }
    return blueprints;
  }

  if (DECISION_GENERIC_PATTERN.test(text)) {
    return [{ type: "decision", reason: "La recomendación describe una decisión pendiente que requiere un dueño y una fecha límite." }];
  }

  if (ACCEPTANCE_CRITERIA_PATTERN.test(text)) {
    if (EXTERNAL_PARTY_PATTERN.test(text)) {
      return [{ type: "dependency", dependencyType: detectDependencyType(text), reason: "Los criterios de aceptación dependen de una definición externa (cliente/proveedor)." }];
    }
    return [{ type: "decision", reason: "Faltan criterios de aceptación del proyecto; se requiere una decisión interna para definirlos." }];
  }

  if (MILESTONE_OVERDUE_PATTERN.test(text)) {
    if (EXTERNAL_PARTY_PATTERN.test(text)) {
      return [{ type: "dependency", dependencyType: detectDependencyType(text), reason: "El hito vencido depende de una parte externa (cliente/proveedor)." }];
    }
    return [{ type: "issue", blocking: true, reason: "El hito vencido es un problema interno de ejecución sin evidencia de bloqueo externo." }];
  }

  if (MISSING_DELIVERABLE_EVIDENCE_PATTERN.test(text)) {
    if (isSevere) {
      return [{ type: "issue", blocking: false, reason: "Falta evidencia de un entregable y la severidad reportada es alta/crítica." }];
    }
    return [{ type: "dependency", dependencyType: detectDependencyType(text), reason: "Falta evidencia de un entregable, sin severidad alta/crítica asociada." }];
  }

  if (RISK_GENERIC_PATTERN.test(text) && isSevere) {
    return [
      {
        type: "risk",
        category: detectRiskCategory(text),
        escalationRecommended: recommendation.severity === "critical",
        reason: "La regla detectó un riesgo de severidad alta/crítica sin mitigación registrada.",
      },
    ];
  }

  if (DEPENDENCY_GENERIC_PATTERN.test(text)) {
    return [{ type: "dependency", dependencyType: detectDependencyType(text), reason: "La recomendación describe una dependencia abierta del proyecto." }];
  }

  return [];
}

function blueprintSubtype(blueprint: OperationalDraftBlueprint): string {
  if (blueprint.type === "risk") return blueprint.category;
  if (blueprint.type === "dependency") return blueprint.dependencyType;
  return "none";
}

function draftFingerprint(recommendation: PlaybookRecommendation, blueprint: OperationalDraftBlueprint): string {
  return createHash("sha256")
    .update(
      `${recommendation.workspaceId}:${recommendation.projectId}:${recommendation.fingerprint}:${recommendation.playbookRuleId}:${blueprint.type}:${blueprintSubtype(blueprint)}`,
    )
    .digest("hex");
}

function impactFromSeverity(recommendation: PlaybookRecommendation): "low" | "medium" | "high" {
  if (recommendation.severity === "critical" || recommendation.severity === "high") return "high";
  if (recommendation.severity === "medium") return "medium";
  return "low";
}

/**
 * Single, centralized rule for whether an operational draft requires human approval before it
 * can be converted into a real risk/issue/dependency/decision. Replaces four previously
 * inconsistent per-type computations (risk folded in its own escalation signal, issue and
 * dependency did not, decision was hard-coded) with one policy:
 *
 * - `recommendationApprovalRequired` can only ever be *elevated*, never relaxed: if the
 *   originating `PlaybookRecommendation` already required approval, every draft derived from it
 *   does too.
 * - `decision` always requires approval — a draft proposing to decide something on the project's
 *   behalf is never auto-approved, regardless of severity.
 * - `risk` additionally requires approval when severity is high/critical or the classification
 *   recommended escalation.
 * - `issue`/`dependency` additionally require approval when they are currently blocking
 *   (`blocking`) or severity is high/critical — a blocking item is exactly the kind of thing that
 *   affects closure/billing readiness and must not be silently converted without review.
 */
export function resolveOperationalDraftApprovalRequirement(params: {
  type: OperationalDraft["type"];
  severity: OperationalDraft["severity"];
  recommendationApprovalRequired: boolean;
  blocking?: boolean;
  escalationRecommended?: boolean;
}): boolean {
  if (params.recommendationApprovalRequired) return true;
  if (params.type === "decision") return true;

  const isSevere = params.severity === "high" || params.severity === "critical";
  if (params.type === "risk") return isSevere || Boolean(params.escalationRecommended);
  return Boolean(params.blocking) || isSevere; // issue | dependency
}

function buildDraft(
  recommendation: PlaybookRecommendation,
  projectContext: OperationalIntelligenceProjectContext,
  blueprint: OperationalDraftBlueprint,
  generatedAt: string,
): OperationalDraft {
  const fingerprint = draftFingerprint(recommendation, blueprint);
  const owner = projectContext.owner?.trim() || null;
  const dueDate = projectContext.dueDate?.trim() || null;

  const common = {
    id: fingerprint,
    fingerprint,
    workspaceId: recommendation.workspaceId,
    projectId: recommendation.projectId,
    linkedRecommendationId: recommendation.id,
    playbookRuleId: recommendation.playbookRuleId,
    status: "draft" as const,
    title: recommendation.title,
    description: recommendation.detectedSituation,
    severity: recommendation.severity,
    owner,
    dueDate,
    evidenceUsed: recommendation.evidenceUsed,
    missingEvidence: recommendation.missingEvidence,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  if (blueprint.type === "risk") {
    const mitigation = projectContext.mitigation?.trim() || null;
    const missingInputs = [!owner && "owner", !mitigation && "mitigation"].filter(Boolean) as string[];
    const approvalRequired = resolveOperationalDraftApprovalRequirement({
      type: "risk",
      severity: recommendation.severity,
      recommendationApprovalRequired: recommendation.approvalRequired,
      escalationRecommended: blueprint.escalationRecommended,
    });
    const base: Omit<RiskDraft, "explanation"> = {
      ...common,
      type: "risk",
      category: blueprint.category,
      probability: null,
      impact: impactFromSeverity(recommendation),
      mitigation,
      escalationRecommended: blueprint.escalationRecommended,
      missingInputs,
      approvalRequired,
    };
    return { ...base, explanation: buildExplanation(recommendation, blueprint, base) };
  }

  if (blueprint.type === "issue") {
    const linkedMilestoneId = projectContext.linkedMilestoneId?.trim() || null;
    const missingInputs = [!owner && "owner", !dueDate && "dueDate"].filter(Boolean) as string[];
    const base: Omit<IssueDraft, "explanation"> = {
      ...common,
      type: "issue",
      blocking: blueprint.blocking,
      linkedMilestoneId,
      impactDescription: recommendation.detectedSituation,
      resolutionSuggestion: recommendation.recommendedAction,
      missingInputs,
      approvalRequired: resolveOperationalDraftApprovalRequirement({
        type: "issue",
        severity: recommendation.severity,
        recommendationApprovalRequired: recommendation.approvalRequired,
        blocking: blueprint.blocking,
      }),
    };
    return { ...base, explanation: buildExplanation(recommendation, blueprint, base) };
  }

  if (blueprint.type === "dependency") {
    const externalParty = projectContext.externalParty?.trim() || null;
    const linkedMilestoneId = projectContext.linkedMilestoneId?.trim() || null;
    const missingInputs = [
      !owner && "owner",
      !dueDate && "dueDate",
      blueprint.dependencyType !== "internal" && !externalParty && "externalParty",
    ].filter(Boolean) as string[];
    const escalationLevel: DependencyDraft["escalationLevel"] =
      recommendation.severity === "critical" ? "critical" : recommendation.severity === "high" ? "formal" : recommendation.severity === "medium" ? "soft" : "none";
    const blockingStatus = recommendation.severity === "critical" || recommendation.severity === "high";
    const base: Omit<DependencyDraft, "explanation"> = {
      ...common,
      type: "dependency",
      dependencyType: blueprint.dependencyType,
      externalParty,
      blockingStatus,
      linkedMilestoneId,
      escalationLevel,
      missingInputs,
      approvalRequired: resolveOperationalDraftApprovalRequirement({
        type: "dependency",
        severity: recommendation.severity,
        recommendationApprovalRequired: recommendation.approvalRequired,
        blocking: blockingStatus,
      }),
    };
    return { ...base, explanation: buildExplanation(recommendation, blueprint, base) };
  }

  const decisionOwner = projectContext.decisionOwner?.trim() || null;
  const deadline = projectContext.decisionDeadline?.trim() || null;
  const options = projectContext.options ?? [];
  const recommendedOption = projectContext.recommendedOption?.trim() || null;
  const consequenceIfNotDecided = projectContext.consequenceIfNotDecided?.trim() || null;
  const missingInputs = [
    !decisionOwner && "decisionOwner",
    !deadline && "decisionDeadline",
    options.length === 0 && "options",
  ].filter(Boolean) as string[];
  const base: Omit<DecisionDraft, "explanation"> = {
    ...common,
    // `common.owner` already comes from `projectContext.owner` (like every other draft type) and
    // is deliberately left as-is here — it is never backfilled from `decisionOwner`. The two
    // answer different questions ("who's tracking this draft" vs. "who must decide") and may
    // legitimately differ or both be unset; see the type-level doc comment on `DecisionDraft`.
    type: "decision",
    decisionOwner,
    options,
    recommendedOption,
    deadline,
    consequenceIfNotDecided,
    missingInputs,
    // Decisions always require human review before they govern a real project — never auto-decided.
    approvalRequired: resolveOperationalDraftApprovalRequirement({
      type: "decision",
      severity: recommendation.severity,
      recommendationApprovalRequired: recommendation.approvalRequired,
    }),
  };
  return { ...base, explanation: buildExplanation(recommendation, blueprint, base) };
}

function buildExplanation(
  recommendation: PlaybookRecommendation,
  blueprint: OperationalDraftBlueprint,
  draft: Omit<OperationalDraft, "explanation">,
): OperationalDraftExplanation {
  const evidenceUsed = draft.evidenceUsed.map((e) => `${e.fact} = ${e.value}`);
  const missingEvidence = [...draft.missingEvidence];
  const missingInputs = [...draft.missingInputs];

  const evidenceClause = evidenceUsed.length > 0 ? evidenceUsed.join(", ") : "sin evidencia adicional registrada";
  const missingEvidenceClause = missingEvidence.length > 0 ? `Falta validar: ${missingEvidence.join(", ")}. ` : "";
  const missingInputsClause =
    missingInputs.length > 0
      ? `Antes de convertirse en un objeto real requiere completar: ${missingInputs.join(", ")}. `
      : "No requiere datos adicionales conocidos para convertirse en un objeto real. ";
  const approvalClause = draft.approvalRequired
    ? "Requiere revisión y aprobación humana antes de convertirse en un objeto operativo real."
    : "No requiere aprobación adicional, pero de igual forma no se convierte automáticamente.";

  const narrative =
    `Este borrador de tipo '${draft.type}' fue generado a partir de la recomendación '${draft.linkedRecommendationId}', ` +
    `respaldada por la regla '${draft.playbookRuleId}' del playbook. Evidencia usada: ${evidenceClause}. ` +
    `${missingEvidenceClause}${missingInputsClause}${approvalClause} ` +
    `Este borrador no fue convertido automáticamente en un risk/issue/dependency/decision real; requiere una acción humana explícita.`;

  return {
    originRecommendation: draft.linkedRecommendationId,
    supportingRule: draft.playbookRuleId,
    classifiedAsBecause: blueprint.reason,
    evidenceUsed,
    missingEvidence,
    missingInputs,
    requiresHumanReview: draft.approvalRequired || missingInputs.length > 0,
    narrative,
  };
}

/**
 * Explains a specific operational draft: which recommendation originated it, which rule
 * supports it, why it was classified as risk/issue/dependency/decision, what evidence backs it,
 * what's missing, and — the governed sentence PMFreak is required to always say here — that it
 * was never converted into a real object automatically.
 */
export function explainOperationalDraftGeneration(draft: OperationalDraft): OperationalDraftExplanation {
  return draft.explanation;
}

/**
 * Converts a governed `PlaybookRecommendation` (Sprint 3) into zero or more governed,
 * never-persisted `OperationalDraft`s (risk/issue/dependency/decision). Pure — no persistence,
 * no event emission, no real object creation. Every free-text/ownership field the recommendation
 * doesn't carry (owner, dueDate, decisionOwner, externalParty, mitigation, options) is only ever
 * populated from `projectContext`; anything missing is reported in `missingInputs` instead of
 * being guessed.
 */
export function generateOperationalDraftsFromRecommendation(
  recommendation: PlaybookRecommendation,
  projectContext: OperationalIntelligenceProjectContext = {},
): PlaybookEngineResult<OperationalDraft[]> {
  if (!recommendation.projectId || recommendation.projectId.trim().length === 0) {
    return { ok: false, error: "recommendation.projectId is required to generate operational drafts.", failureClass: "validation_failed" };
  }
  if (!recommendation.workspaceId || recommendation.workspaceId.trim().length === 0) {
    return { ok: false, error: "recommendation.workspaceId is required to generate operational drafts.", failureClass: "validation_failed" };
  }

  const blueprints = selectOperationalDraftTypesForRecommendation(recommendation);
  const generatedAt = new Date().toISOString();
  const drafts = blueprints.map((blueprint) => buildDraft(recommendation, projectContext, blueprint, generatedAt));

  return { ok: true, data: drafts };
}

/**
 * Processes several recommendations at once, deduplicating by fingerprint within the batch.
 * Does not merge against previously known drafts — see `mergeOperationalDrafts` for that.
 */
export function generateOperationalDraftsFromRecommendations(
  recommendations: PlaybookRecommendation[],
  projectContext: OperationalIntelligenceProjectContext = {},
): PlaybookEngineResult<OperationalDraft[]> {
  const drafts: OperationalDraft[] = [];
  const seen = new Set<string>();

  for (const recommendation of recommendations) {
    const result = generateOperationalDraftsFromRecommendation(recommendation, projectContext);
    if (!result.ok) return result;
    for (const draft of result.data) {
      if (seen.has(draft.fingerprint)) continue;
      seen.add(draft.fingerprint);
      drafts.push(draft);
    }
  }

  return { ok: true, data: drafts };
}

/**
 * Merges freshly generated operational drafts into a previously known set, keyed by fingerprint.
 * Mirrors `mergePlaybookRecommendations`/`mergeCommunicationDrafts`: never produces duplicates,
 * and a fingerprint already present keeps its prior status (a human decision on a draft must
 * never be silently reset by regenerating it) while refreshing content/evidence-derived fields.
 */
export function mergeOperationalDrafts(previous: OperationalDraft[], next: OperationalDraft[]): OperationalDraft[] {
  const previousByFingerprint = new Map(previous.map((draft) => [draft.fingerprint, draft] as const));
  const merged: OperationalDraft[] = [];
  const seen = new Set<string>();

  for (const incoming of next) {
    if (seen.has(incoming.fingerprint)) continue;
    seen.add(incoming.fingerprint);

    const existing = previousByFingerprint.get(incoming.fingerprint);
    if (!existing) {
      merged.push(incoming);
      continue;
    }

    merged.push({
      ...existing,
      ...incoming,
      status: existing.status,
      createdAt: existing.createdAt,
      updatedAt: incoming.updatedAt,
    } as OperationalDraft);
  }

  return merged;
}
