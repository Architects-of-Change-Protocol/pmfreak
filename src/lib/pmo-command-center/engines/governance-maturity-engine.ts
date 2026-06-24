import type { GovernanceMaturityInput } from "../types";

// ─── calculateGovernanceMaturity ─────────────────────────────────────────────
//
// Governance maturity is based on:
//  - Average compliance score across all PMs (70%)
//  - Penalty for governance debt and hotspots (30%)

export function calculateGovernanceMaturity(input: GovernanceMaturityInput): number {
  if (input.avgComplianceScore === 0 && input.totalGovernanceDebt === 0) return 100;

  // Base from average compliance
  const base = input.avgComplianceScore * 0.70;

  // Debt penalty: each unit of critical/high debt reduces maturity
  const debtPenalty    = Math.min(20, input.totalGovernanceDebt * 0.5);
  const hotspotPenalty = Math.min(10, input.hotspotCount * 2);

  const raw = base - debtPenalty - hotspotPenalty + (input.avgComplianceScore * 0.30);
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}
