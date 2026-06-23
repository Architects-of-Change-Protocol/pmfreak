import type { CalculatePMUtilizationInput } from "../types";

export function calculatePMUtilization(input: CalculatePMUtilizationInput): number {
  if (input.capacity <= 0) return 0;
  const raw = (input.load / input.capacity) * 100;
  return Math.max(0, Math.round(raw * 100) / 100);
}
