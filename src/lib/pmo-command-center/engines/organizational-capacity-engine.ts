import type { OrganizationalCapacityInput } from "../types";

// ─── calculateOrganizationalCapacity ─────────────────────────────────────────
//
// Returns a 0-100 score representing available organizational capacity.
// A score of 100 = fully underutilized (no load).
// A score of 0 = critically overloaded.

export function calculateOrganizationalCapacity(input: OrganizationalCapacityInput): number {
  if (input.pmCount === 0) return 100;

  // Base: invert the average utilization percentage
  const utilizationScore = Math.max(0, 100 - input.avgUtilizationPercentage);

  // Penalty: overloaded PMs reduce capacity score
  const overloadRatio   = input.overloadedPMCount / input.pmCount;
  const overloadPenalty = overloadRatio * 30;

  // Bonus: healthy PMs add resilience
  const healthyRatio  = input.healthyPMCount / input.pmCount;
  const healthyBonus  = healthyRatio * 10;

  const raw = utilizationScore - overloadPenalty + healthyBonus;
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

// ─── calculateAvailableCapacityPercentage ────────────────────────────────────

export function calculateAvailableCapacityPercentage(
  totalCapacity: number,
  totalLoad: number
): number {
  if (totalCapacity <= 0) return 0;
  const available = Math.max(0, totalCapacity - totalLoad);
  return Math.round((available / totalCapacity) * 100 * 100) / 100;
}
