import type { ConsequenceScenario, ConsequenceSeverity } from "./types";

// ─── generateConsequenceScenarios ────────────────────────────────────────────
// Generates best_case (0.20), expected_case (0.60), worst_case (0.20) scenarios.

export function generateConsequenceScenarios(input: {
  focusType: string;
  severity: ConsequenceSeverity;
  escalationProbability: number;
  impactScore: number;
}): ConsequenceScenario[] {
  const { focusType, severity, escalationProbability, impactScore } = input;

  const bestDesc   = buildScenarioDescription("best_case",    focusType, severity, impactScore, escalationProbability);
  const expectDesc = buildScenarioDescription("expected_case", focusType, severity, impactScore, escalationProbability);
  const worstDesc  = buildScenarioDescription("worst_case",   focusType, severity, impactScore, escalationProbability);

  return [
    { name: "best_case",     description: bestDesc,   probability: 0.20 },
    { name: "expected_case", description: expectDesc, probability: 0.60 },
    { name: "worst_case",    description: worstDesc,  probability: 0.20 },
  ];
}

function buildScenarioDescription(
  scenario: string,
  focusType: string,
  severity: ConsequenceSeverity,
  impactScore: number,
  escalationProbability: number
): string {
  const focusLabel  = focusType.replace(/_/g, " ");
  const escPct      = Math.round(escalationProbability * 100);

  switch (scenario) {
    case "best_case":
      return (
        `The ${focusLabel} is addressed within the recommended horizon. ` +
        `Impact is contained and no downstream entities are affected. ` +
        `Escalation does not occur (${escPct}% escalation probability neutralized by timely action).`
      );
    case "expected_case":
      return (
        `The ${focusLabel} receives partial attention. ` +
        `Impact score of ${impactScore} propagates to downstream commitments and projections. ` +
        `Severity remains at ${severity} with ${escPct}% probability of further escalation.`
      );
    case "worst_case":
      return (
        `The ${focusLabel} is left unaddressed beyond the impact horizon. ` +
        `Cascading effects reach all dependent entities. ` +
        `Severity escalates beyond ${severity}, triggering governance interventions and health degradation.`
      );
    default:
      return `Scenario for ${focusLabel} under ${severity} severity.`;
  }
}
