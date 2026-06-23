import type { CalculatePMCapacityInput } from "../types";

// Role multipliers: more senior roles carry larger portfolio scope
const ROLE_CAPACITY_MULTIPLIERS: Record<string, number> = {
  project_manager:   1.00,
  senior_pm:         1.15,
  program_manager:   1.25,
  portfolio_manager: 1.40,
};

// Experience multipliers
const EXPERIENCE_CAPACITY_MULTIPLIERS: Record<string, number> = {
  junior:    0.80,
  mid:       1.00,
  senior:    1.20,
  principal: 1.35,
};

export function calculatePMCapacity(input: CalculatePMCapacityInput): number {
  const base = Math.max(0, input.capacityLimit);

  const roleMultiplier       = ROLE_CAPACITY_MULTIPLIERS[input.role]            ?? 1.00;
  const experienceMultiplier = EXPERIENCE_CAPACITY_MULTIPLIERS[input.experienceLevel] ?? 1.00;

  // Project limit adds proportional headroom
  const projectBudget = input.activeProjectsLimit * 10;

  const capacity = base * roleMultiplier * experienceMultiplier + (projectBudget - 50);

  return Math.max(10, Math.round(capacity));
}
