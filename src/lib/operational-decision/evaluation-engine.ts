import type { DecisionAlternative, DecisionEvaluationScores } from "./types";

// ─── evaluateDecisionOptions ──────────────────────────────────────────────────
// Evaluates each alternative across 4 dimensions: governance, execution, risk, health.
// Higher score = better outcome in that dimension (0–100).

export function evaluateDecisionOptions(input: {
  alternatives: DecisionAlternative[];
  consequenceSeverity: string;
  escalationProbability: number;
  impactScore: number;
}): Array<{ optionName: string; scores: DecisionEvaluationScores }> {
  return input.alternatives.map((alt) => ({
    optionName: alt.optionName,
    scores:     scoreAlternative(alt, input.consequenceSeverity, input.escalationProbability, input.impactScore),
  }));
}

// ─── scoreAlternative ─────────────────────────────────────────────────────────

function scoreAlternative(
  alt:                   DecisionAlternative,
  consequenceSeverity:   string,
  escalationProbability: number,
  impactScore:           number
): DecisionEvaluationScores {
  const severityMultiplier: Record<string, number> = {
    systemic: 1.0,
    critical: 0.9,
    high:     0.8,
    medium:   0.6,
    low:      0.4,
  };
  const sv = severityMultiplier[consequenceSeverity] ?? 0.6;

  const governanceScore = calculateGovernanceScore(alt, sv);
  const executionScore  = calculateExecutionScore(alt, escalationProbability);
  const riskScore       = calculateRiskScore(alt, impactScore);
  const healthScore     = calculateHealthScore(alt, sv);

  const overallScore = Math.round(
    governanceScore * 0.30 +
    executionScore  * 0.30 +
    riskScore       * 0.25 +
    healthScore     * 0.15
  );

  return {
    governanceScore: Math.round(governanceScore),
    executionScore:  Math.round(executionScore),
    riskScore:       Math.round(riskScore),
    healthScore:     Math.round(healthScore),
    overallScore:    Math.max(0, Math.min(100, overallScore)),
  };
}

// ─── Dimension Calculators ────────────────────────────────────────────────────

function calculateGovernanceScore(alt: DecisionAlternative, severityMultiplier: number): number {
  const typeBonus: Record<string, number> = {
    governance:  30,
    authority:   25,
    structural:  20,
    commitment:  15,
    escalation:  10,
    execution:    5,
    resource:     5,
    risk:         0,
  };
  const base   = typeBonus[alt.optionType] ?? 10;
  const effort = alt.estimatedEffort === "high" ? 15 : alt.estimatedEffort === "medium" ? 10 : 5;
  return Math.min(100, Math.round((base + effort) * (1 + severityMultiplier * 0.5)));
}

function calculateExecutionScore(alt: DecisionAlternative, escalationProbability: number): number {
  const effortPenalty: Record<string, number> = { low: 0, medium: 10, high: 20 };
  const typeBonus: Record<string, number>     = {
    execution: 40, resource: 35, commitment: 30, escalation: 20,
    governance: 15, authority: 15, structural: 10, risk: 10,
  };
  const penalty = effortPenalty[alt.estimatedEffort] ?? 10;
  const base    = typeBonus[alt.optionType] ?? 10;
  const escBonus = escalationProbability > 0.7 ? 15 : escalationProbability > 0.4 ? 8 : 0;
  return Math.max(0, Math.min(100, Math.round(base + escBonus - penalty)));
}

function calculateRiskScore(alt: DecisionAlternative, impactScore: number): number {
  const riskPenalty: Record<string, number> = {
    low: 0, medium: 15, high: 30, critical: 50,
  };
  const penalty   = riskPenalty[alt.estimatedRisk] ?? 15;
  const impactAdj = impactScore > 70 ? 10 : impactScore > 40 ? 5 : 0;
  return Math.max(0, Math.min(100, Math.round(80 - penalty + impactAdj)));
}

function calculateHealthScore(alt: DecisionAlternative, severityMultiplier: number): number {
  const proCount = alt.pros.length;
  const conCount = alt.cons.length;
  const base     = 50 + (proCount - conCount) * 8;
  return Math.max(0, Math.min(100, Math.round(base * (1 + severityMultiplier * 0.3))));
}
