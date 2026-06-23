import type { DecisionAlternative, DecisionTradeoff } from "./types";

// ─── analyzeDecisionTradeoffs ─────────────────────────────────────────────────
// Converts pros/cons from an alternative into structured DecisionTradeoff records.

export function analyzeDecisionTradeoffs(
  alternatives: DecisionAlternative[]
): Array<{ optionName: string; tradeoffs: DecisionTradeoff[] }> {
  return alternatives.map((alt) => ({
    optionName: alt.optionName,
    tradeoffs:  buildTradeoffs(alt),
  }));
}

function buildTradeoffs(alt: DecisionAlternative): DecisionTradeoff[] {
  const riskImpact: Record<string, number> = { low: 20, medium: 45, high: 65, critical: 85 };
  const effortImpact: Record<string, number> = { low: 15, medium: 40, high: 70 };

  const result: DecisionTradeoff[] = [];

  for (const pro of alt.pros) {
    result.push({
      tradeoffType: "pro",
      description:  pro,
      impactScore:  calculateProImpact(alt, pro),
    });
  }

  for (const con of alt.cons) {
    result.push({
      tradeoffType: "con",
      description:  con,
      impactScore:  riskImpact[alt.estimatedRisk] ?? 45,
    });
  }

  // Structural tradeoff: effort cost
  result.push({
    tradeoffType: "con",
    description:  `Estimated implementation effort: ${alt.estimatedEffort}`,
    impactScore:  effortImpact[alt.estimatedEffort] ?? 40,
  });

  return result;
}

function calculateProImpact(alt: DecisionAlternative, _pro: string): number {
  const typeBonus: Record<string, number> = {
    governance:  70,
    authority:   65,
    execution:   60,
    commitment:  55,
    escalation:  50,
    resource:    50,
    risk:        45,
    structural:  40,
  };
  const base = typeBonus[alt.optionType] ?? 50;
  const effortBonus = alt.estimatedEffort === "high" ? 10 : alt.estimatedEffort === "medium" ? 5 : 0;
  return Math.min(100, base + effortBonus);
}
