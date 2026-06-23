import type { DetectPMOverloadInput, PMCapacityStatus } from "../types";
import { PM_CAPACITY_STATUS_THRESHOLDS } from "../types";

export function detectPMOverload(input: DetectPMOverloadInput): PMCapacityStatus {
  const u = input.utilizationPercentage;

  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.overloaded) return "critical";
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.busy)       return "overloaded";
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.healthy)    return "busy";
  if (u >= PM_CAPACITY_STATUS_THRESHOLDS.underutilized) return "healthy";
  return "underutilized";
}
