import { PM_PERFORMANCE_STATUS_THRESHOLDS } from "../types";
import type { PMPerformanceStatus } from "../types";

export function classifyPMPerformanceStatus(score: number): PMPerformanceStatus {
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.excellent) return "excellent";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.strong)    return "strong";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.stable)    return "stable";
  if (score >= PM_PERFORMANCE_STATUS_THRESHOLDS.warning)   return "warning";
  return "critical";
}
