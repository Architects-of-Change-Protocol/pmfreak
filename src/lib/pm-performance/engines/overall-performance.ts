import { PM_PERFORMANCE_WEIGHTS } from "../types";
import type { OverallPerformanceInput } from "../types";

export function calculatePMOverallPerformance(scores: OverallPerformanceInput): number {
  const w = PM_PERFORMANCE_WEIGHTS;
  const weighted =
    scores.governance * w.governance +
    scores.execution  * w.execution  +
    scores.prediction * w.prediction +
    scores.decision   * w.decision   +
    scores.portfolio  * w.portfolio;

  return Math.max(0, Math.min(100, Math.round(weighted)));
}
