import { PMO_HEALTH_WEIGHTS, PMO_STATUS_THRESHOLDS } from "../types";
import type { PMOHealthInput, PMOStatus } from "../types";

// ─── calculatePMOHealth ───────────────────────────────────────────────────────

export function calculatePMOHealth(input: PMOHealthInput): number {
  const { performance, capacity, compliance, projectHealth } = PMO_HEALTH_WEIGHTS;

  const weighted =
    input.avgPerformanceScore  * performance  +
    input.avgCapacityScore     * capacity     +
    input.avgComplianceScore   * compliance   +
    input.projectHealthScore   * projectHealth;

  return Math.round(Math.min(100, Math.max(0, weighted)) * 100) / 100;
}

// ─── classifyPMOStatus ────────────────────────────────────────────────────────

export function classifyPMOStatus(healthScore: number): PMOStatus {
  if (healthScore >= PMO_STATUS_THRESHOLDS.excellent) return "excellent";
  if (healthScore >= PMO_STATUS_THRESHOLDS.healthy)   return "healthy";
  if (healthScore >= PMO_STATUS_THRESHOLDS.stable)    return "stable";
  if (healthScore >= PMO_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}
