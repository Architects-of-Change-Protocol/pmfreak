import { createHash } from "node:crypto";

import { evaluatePlaybookRules } from "./rules-engine";
import type {
  DeliveryPlaybook,
  PlaybookEngineResult,
  PlaybookEvidenceUsed,
  PlaybookFactKey,
  PlaybookRuleEvaluation,
  PlaybookRuleScope,
  PlaybookRuleSeverity,
  PlaybookSuggestedAction,
  ProjectContextFacts,
} from "./types";

/**
 * Lifecycle a recommendation moves through. Transitions between these are governed by
 * `recommendation-state.ts`, never mutated ad hoc — see that module for the allowed graph.
 */
export type PlaybookRecommendationStatus =
  | "new"
  | "viewed"
  | "accepted"
  | "dismissed"
  | "converted_to_task"
  | "converted_to_draft"
  | "requires_approval"
  | "approved"
  | "executed";

/** Reuses the Rules Engine's severity scale (Sprint 1) instead of inventing a parallel one. */
export type PlaybookRecommendationSeverity = PlaybookRuleSeverity;

/** Identical shape to `PlaybookSuggestedAction` (Sprint 2) — a recommendation only ever surfaces
 * the actions its firing rule already declared, never invents new ones. */
export type PlaybookRecommendationAction = PlaybookSuggestedAction;

export type PlaybookRecommendationExplanation = {
  detectedCondition: string;
  activatedRule: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  recommendedAction: string;
  requiresHumanApproval: boolean;
  /** Statuses this recommendation could reach next, purely structural (derived from its own
   * approvalRequired/suggestedActions — never a promise that a downstream sprint exists yet). */
  availableConversions: PlaybookRecommendationStatus[];
  futureCapabilities: string[];
  /** The single governed sentence PMFreak is allowed to say instead of an opinion. */
  narrative: string;
};

export type PlaybookRecommendation = {
  id: string;
  /** Deterministic sha256 of (workspaceId, projectId, playbookId, playbookVersion, ruleId).
   * Re-evaluating the same context always yields the same fingerprint/id — this is the sole
   * idempotency mechanism in this sprint, since there is no persistence layer yet. */
  fingerprint: string;
  workspaceId: string;
  projectId: string;
  playbookId: string;
  playbookVersion: number;
  playbookRuleId: string;
  ruleName: string;
  title: string;
  detectedSituation: string;
  phase: PlaybookRuleScope;
  severity: PlaybookRecommendationSeverity;
  status: PlaybookRecommendationStatus;
  /** 0-100, the share of the rule's evidenceFacts that were actually known (never invented —
   * derived purely from evidenceUsed/missingEvidence counts). */
  confidence: number;
  evidenceUsed: PlaybookEvidenceUsed[];
  missingEvidence: PlaybookFactKey[];
  recommendedAction: string;
  suggestedActions: PlaybookRecommendationAction[];
  approvalRequired: boolean;
  hasApprovalSensitiveActions: boolean;
  explanation: PlaybookRecommendationExplanation;
  createdAt: string;
  updatedAt: string;
};

export type GeneratePlaybookRecommendationsResult = {
  recommendations: PlaybookRecommendation[];
  /** Rule ids that could not be evaluated (missing evidence) — reported separately, never
   * turned into a recommendation, per the "no inventar datos" principle from Sprint 1. */
  indeterminateRuleIds: string[];
};

function computeConfidence(evaluation: PlaybookRuleEvaluation): number {
  const total = evaluation.evidenceUsed.length + evaluation.evidenceMissing.length;
  if (total === 0) return 100;
  return Math.round((evaluation.evidenceUsed.length / total) * 100);
}

function recommendationFingerprint(
  workspaceId: string,
  projectId: string,
  playbookId: string,
  playbookVersion: number,
  ruleId: string,
): string {
  return createHash("sha256")
    .update(`${workspaceId}:${projectId}:${playbookId}:${playbookVersion}:${ruleId}`)
    .digest("hex");
}

function buildRecommendationFromEvaluation(
  context: ProjectContextFacts,
  playbook: DeliveryPlaybook,
  evaluation: PlaybookRuleEvaluation,
  generatedAt: string,
): PlaybookRecommendation {
  const suggestedActions: PlaybookRecommendationAction[] = evaluation.suggestedActions ?? [];
  const hasApprovalSensitiveActions = suggestedActions.some((action) => action.approvalRequired);
  const fingerprint = recommendationFingerprint(
    context.workspaceId,
    context.projectId,
    playbook.id,
    playbook.version,
    evaluation.ruleId,
  );

  const base: Omit<PlaybookRecommendation, "explanation"> = {
    id: fingerprint,
    fingerprint,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    playbookId: playbook.id,
    playbookVersion: playbook.version,
    playbookRuleId: evaluation.ruleId,
    ruleName: evaluation.title,
    title: evaluation.title,
    detectedSituation: evaluation.description,
    phase: evaluation.scope,
    severity: evaluation.severity,
    status: "new",
    confidence: computeConfidence(evaluation),
    evidenceUsed: evaluation.evidenceUsed,
    missingEvidence: evaluation.evidenceMissing,
    // Non-null: only "fired" evaluations reach this function.
    recommendedAction: evaluation.recommendationTemplate as string,
    suggestedActions,
    approvalRequired: hasApprovalSensitiveActions,
    hasApprovalSensitiveActions,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  return { ...base, explanation: explainPlaybookRecommendation(base as PlaybookRecommendation, playbook) };
}

/**
 * Converts fired rule evaluations from the Rules Engine (Sprint 1) into governed, explainable
 * recommendations. Pure — no persistence, no event emission, no execution. `indeterminate`
 * evaluations are reported separately (`indeterminateRuleIds`) and never turned into a
 * recommendation; `not_fired` evaluations are dropped since there is nothing to recommend.
 */
export function generatePlaybookRecommendations(
  context: ProjectContextFacts,
  playbook: DeliveryPlaybook,
): PlaybookEngineResult<GeneratePlaybookRecommendationsResult> {
  if (!context.projectId || context.projectId.trim().length === 0) {
    return { ok: false, error: "context.projectId is required to generate recommendations.", failureClass: "validation_failed" };
  }
  if (!context.workspaceId || context.workspaceId.trim().length === 0) {
    return { ok: false, error: "context.workspaceId is required to generate recommendations.", failureClass: "validation_failed" };
  }

  const evaluations = evaluatePlaybookRules(playbook, context);
  const generatedAt = new Date().toISOString();

  const recommendations = evaluations
    .filter((evaluation) => evaluation.status === "fired")
    .map((evaluation) => buildRecommendationFromEvaluation(context, playbook, evaluation, generatedAt));

  const indeterminateRuleIds = evaluations
    .filter((evaluation) => evaluation.status === "indeterminate")
    .map((evaluation) => evaluation.ruleId);

  return { ok: true, data: { recommendations, indeterminateRuleIds } };
}

function evidenceUsedLine(entry: PlaybookEvidenceUsed): string {
  return `${entry.fact} = ${entry.value}`;
}

/**
 * Explains a specific recommendation: what was detected, which rule fired, what evidence
 * supports it, what's missing, what action is recommended, and whether it can execute on its
 * own. This is the mechanism behind the governing principle: PMFreak never says "I think you
 * should X" — it says "the playbook rule fired on this evidence, this is missing, and this is
 * the recommended action."
 */
export function explainPlaybookRecommendation(
  recommendation: PlaybookRecommendation,
  playbook?: DeliveryPlaybook,
): PlaybookRecommendationExplanation {
  const evidenceUsed = recommendation.evidenceUsed.map(evidenceUsedLine);
  const missingEvidence = [...recommendation.missingEvidence];

  const availableConversions: PlaybookRecommendationStatus[] = recommendation.approvalRequired
    ? ["viewed", "accepted", "requires_approval", "dismissed"]
    : ["viewed", "accepted", "converted_to_task", "converted_to_draft", "dismissed"];

  const futureCapabilities = [
    "Podrá convertirse en un task draft gobernado (módulo task-drafts) en un sprint futuro de integración.",
    "La generación de communication drafts (Communications Playbook) todavía no está implementada.",
  ];

  const playbookLabel = playbook ? `'${playbook.name}' (v${playbook.version})` : `'${recommendation.playbookId}' (v${recommendation.playbookVersion})`;
  const evidenceClause = evidenceUsed.length > 0 ? evidenceUsed.join(", ") : "sin evidencia adicional registrada";
  const missingClause =
    missingEvidence.length > 0
      ? `Falta validar: ${missingEvidence.join(", ")}.`
      : "No falta evidencia adicional para esta regla.";
  const approvalClause = recommendation.approvalRequired
    ? "Esta recomendación incluye al menos una acción que requiere aprobación humana antes de ejecutarse."
    : "Ninguna de las acciones sugeridas requiere aprobación humana previa, pero ninguna se ejecuta automáticamente en este sprint.";

  const narrative =
    `Según el playbook ${playbookLabel}, la regla '${recommendation.playbookRuleId}' (${recommendation.ruleName}) se activó por: ${evidenceClause}. ` +
    `${missingClause} La acción recomendada es: ${recommendation.recommendedAction} ${approvalClause}`;

  return {
    detectedCondition: recommendation.detectedSituation,
    activatedRule: `${recommendation.playbookRuleId} — ${recommendation.ruleName}`,
    evidenceUsed,
    missingEvidence,
    recommendedAction: recommendation.recommendedAction,
    requiresHumanApproval: recommendation.approvalRequired,
    availableConversions,
    futureCapabilities,
    narrative,
  };
}

/**
 * Merges freshly generated recommendations into a previously known set, keyed by fingerprint.
 * Never produces duplicates: a fingerprint already present keeps its prior status/timestamps
 * (a human decision already made must never be silently reset by re-evaluation) while refreshing
 * the evidence-derived fields (confidence/evidenceUsed/missingEvidence/explanation) so the
 * explanation always reflects the latest known facts. Brand-new fingerprints are appended as-is.
 */
export function mergePlaybookRecommendations(
  previous: PlaybookRecommendation[],
  next: PlaybookRecommendation[],
): PlaybookRecommendation[] {
  const previousByFingerprint = new Map(previous.map((rec) => [rec.fingerprint, rec] as const));
  const merged: PlaybookRecommendation[] = [];
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
      confidence: incoming.confidence,
      evidenceUsed: incoming.evidenceUsed,
      missingEvidence: incoming.missingEvidence,
      recommendedAction: incoming.recommendedAction,
      suggestedActions: incoming.suggestedActions,
      approvalRequired: incoming.approvalRequired,
      hasApprovalSensitiveActions: incoming.hasApprovalSensitiveActions,
      explanation: incoming.explanation,
      updatedAt: incoming.updatedAt,
    });
  }

  return merged;
}
