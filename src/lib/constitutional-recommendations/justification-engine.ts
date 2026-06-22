// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Justification Engine
// Produces human-readable justification for every recommendation.
// Sovereignty Principle 2: Every recommendation must be traceable.
// Sovereignty Principle 4: Every recommendation must justify its origin.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ConstitutionalRecommendationRow,
  RecommendationJustification,
} from "./types";

export type JustificationInput = {
  recommendation: ConstitutionalRecommendationRow;
  patternKey: string;
  patternType: string;
  evidenceCount: number;
};

export function generateRecommendationJustification(
  input: JustificationInput,
): RecommendationJustification {
  const evidenceLabel = formatEvidenceLabel(input.evidenceCount);
  const because = buildBecauseClause(input.patternType, input.patternKey);

  return {
    recommendation: input.recommendation.recommendation_text,
    because,
    evidence: evidenceLabel,
    confidence: input.recommendation.confidence_score,
    patternKey: input.patternKey,
    patternType: input.patternType,
  };
}

function buildBecauseClause(patternType: string, patternKey: string): string {
  const typeLabel = PATTERN_TYPE_LABELS[patternType] ?? patternType.replace(/_/g, " ");
  const keyLabel = patternKey.replace(/_/g, " ");
  return `${typeLabel}: ${keyLabel}`;
}

function formatEvidenceLabel(evidenceCount: number): string {
  if (evidenceCount === 0) return "No supporting digests recorded yet.";
  if (evidenceCount === 1) return "1 digest";
  return `${evidenceCount} digests`;
}

const PATTERN_TYPE_LABELS: Record<string, string> = {
  risk_pattern: "Risk pattern",
  governance_pattern: "Governance pattern",
  decision_pattern: "Decision pattern",
  authority_pattern: "Authority pattern",
  amendment_pattern: "Amendment pattern",
  delivery_pattern: "Delivery pattern",
  outcome_pattern: "Outcome pattern",
};
