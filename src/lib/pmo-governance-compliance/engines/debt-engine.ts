import type { GovernanceDebt, GovernanceGap } from "../types";

export function calculateGovernanceDebt(gaps: GovernanceGap[]): GovernanceDebt {
  const debt: GovernanceDebt = { low: 0, medium: 0, high: 0, critical: 0, total: 0 };
  for (const gap of gaps) {
    debt[gap.severity]++;
    debt.total++;
  }
  return debt;
}
