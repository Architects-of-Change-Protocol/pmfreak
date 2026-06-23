import type {
  EffectivenessLevel,
  OperationalOutcomeObservationRow,
  OperationalOutcomeEffectRow,
} from "./types";

// ─── classifyEffectivenessLevel ───────────────────────────────────────────────
// Maps a 0–100 score to a level label.

export function classifyEffectivenessLevel(score: number): EffectivenessLevel {
  if (score >= 81) return "excellent";
  if (score >= 61) return "high";
  if (score >= 41) return "medium";
  if (score >= 21) return "low";
  return "very_low";
}

// ─── calculateDecisionEffectiveness ──────────────────────────────────────────
// Weighted composite of 5 factors:
//   1. Expected Impact Achievement  (35%)
//   2. Health Improvement           (20%)
//   3. Risk Reduction               (20%)
//   4. Execution Improvement        (15%)
//   5. Governance Improvement       (10%)

export function calculateDecisionEffectiveness(params: {
  expectedImpactScore: number;
  actualImpactScore: number;
  observations: OperationalOutcomeObservationRow[];
  effects: OperationalOutcomeEffectRow[];
}): number {
  const { expectedImpactScore, actualImpactScore, observations, effects } = params;

  // Factor 1 — expected impact achievement
  const achievementRatio = expectedImpactScore > 0
    ? Math.min(actualImpactScore / expectedImpactScore, 1)
    : 0;
  const impactAchievement = achievementRatio * 100;

  // Factor 2 — health improvement (avg of governance_health + execution_health effects)
  const healthEffects = effects.filter(e =>
    e.effect_type === "governance_health" || e.effect_type === "execution_health"
  );
  const healthImprovement = healthEffects.length > 0
    ? healthEffects.reduce((s, e) => s + Math.max(e.improvement_percentage, 0), 0) / healthEffects.length
    : 0;

  // Factor 3 — risk reduction
  const riskEffects = effects.filter(e => e.effect_type === "risk_reduction");
  const riskReduction = riskEffects.length > 0
    ? riskEffects.reduce((s, e) => s + Math.max(e.improvement_percentage, 0), 0) / riskEffects.length
    : 0;

  // Factor 4 — execution improvement
  const execObs = observations.filter(o => o.observation_type === "execution_health");
  const executionImprovement = execObs.length > 0
    ? execObs.reduce((s, o) => s + o.observation_value, 0) / execObs.length
    : 0;

  // Factor 5 — governance improvement
  const govObs = observations.filter(o => o.observation_type === "governance_health");
  const governanceImprovement = govObs.length > 0
    ? govObs.reduce((s, o) => s + o.observation_value, 0) / govObs.length
    : 0;

  const score =
    impactAchievement  * 0.35 +
    Math.min(healthImprovement,     100) * 0.20 +
    Math.min(riskReduction,         100) * 0.20 +
    Math.min(executionImprovement,  100) * 0.15 +
    Math.min(governanceImprovement, 100) * 0.10;

  return Math.round(Math.min(Math.max(score, 0), 100) * 100) / 100;
}
