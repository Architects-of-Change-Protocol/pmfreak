// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Applicability Engine
// Evaluates how applicable a recommendation is to the current project context.
// Sovereignty Principle 5: The recommendation never replaces human decision.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ApplicabilityContext,
  ApplicabilityLevel,
  RecommendationApplicability,
  ConstitutionalRecommendationRow,
} from "./types";

export function evaluateRecommendationApplicability(
  recommendation: ConstitutionalRecommendationRow,
  context: ApplicabilityContext,
): RecommendationApplicability {
  let score = 0;
  const rationale: string[] = [];

  // Confidence contribution (40% of score)
  const confidenceScore = recommendation.confidence_score * 0.4;
  score += confidenceScore;
  if (recommendation.confidence_score >= 0.75) {
    rationale.push(`High pattern confidence (${recommendation.confidence_score}) supports strong applicability.`);
  } else if (recommendation.confidence_score >= 0.5) {
    rationale.push(`Moderate pattern confidence (${recommendation.confidence_score}).`);
  } else {
    rationale.push(`Low pattern confidence (${recommendation.confidence_score}) — apply with caution.`);
  }

  // Risk pattern overlap (30% of score)
  const presentRisks = context.presentRiskKeys ?? [];
  const observedPatterns = context.observedPatternKeys ?? [];

  const recKey = recommendation.recommendation_key;
  const patternKey = recKey.includes("::") ? recKey.split("::")[1] : recKey;

  const riskMatch = presentRisks.some(
    (r) => r === patternKey || r.includes(patternKey) || patternKey.includes(r),
  );
  const patternMatch = observedPatterns.some(
    (p) => p === patternKey || p.includes(patternKey) || patternKey.includes(p),
  );

  if (riskMatch) {
    score += 0.3;
    rationale.push(`Active risk "${patternKey}" directly matches recommendation pattern.`);
  } else if (patternMatch) {
    score += 0.2;
    rationale.push(`Observed pattern "${patternKey}" aligns with recommendation scope.`);
  } else {
    score += 0.05;
    rationale.push("No direct risk or pattern overlap detected in current context.");
  }

  // Scope alignment (20% of score)
  const scopeScore = scoreScopeAlignment(recommendation.recommendation_scope, context);
  score += scopeScore * 0.2;
  if (scopeScore >= 0.8) {
    rationale.push(`Recommendation scope "${recommendation.recommendation_scope}" strongly matches project context.`);
  } else if (scopeScore >= 0.4) {
    rationale.push(`Recommendation scope "${recommendation.recommendation_scope}" partially matches context.`);
  }

  // Evidence count (10% of score)
  const evidenceScore = Math.min(1.0, recommendation.supporting_pattern_count / 5);
  score += evidenceScore * 0.1;
  if (recommendation.supporting_pattern_count >= 3) {
    rationale.push(`${recommendation.supporting_pattern_count} supporting patterns provide broad evidence.`);
  }

  const finalScore = round3(Math.min(1.0, score));
  const level = classifyApplicability(finalScore);

  return { level, score: finalScore, rationale };
}

function scoreScopeAlignment(scope: string, context: ApplicabilityContext): number {
  const constitutionStatus = context.constitutionStatus ?? "";
  const projectType = context.projectType ?? "";

  // Governance and authority scopes always relevant
  if (scope === "governance" || scope === "authority") return 0.9;

  // Ratification scope: high relevance if constitution is active
  if (scope === "ratification" && constitutionStatus === "active") return 0.9;
  if (scope === "ratification") return 0.6;

  // Delivery scope: high relevance for delivery-type projects
  if (scope === "delivery" && (projectType === "delivery" || projectType === "implementation")) return 0.9;
  if (scope === "delivery") return 0.7;

  // Portfolio scope: relevant for portfolio/program contexts
  if (scope === "portfolio" && projectType === "portfolio") return 0.9;
  if (scope === "portfolio") return 0.5;

  // Project scope: broadly relevant
  if (scope === "project") return 0.8;

  // Decision / risk / amendment: moderately relevant by default
  return 0.65;
}

function classifyApplicability(score: number): ApplicabilityLevel {
  if (score >= 0.65) return "high";
  if (score >= 0.40) return "medium";
  return "low";
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
