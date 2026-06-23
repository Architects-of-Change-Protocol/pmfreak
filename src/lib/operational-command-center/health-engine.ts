import type { OperationalFocusItemRow, CommandCenterHealth, OperationalPriority } from "./types";
import { calculateOverallPriority } from "./priority-engine";

// ─── Command Center Health Engine ─────────────────────────────────────────────
//
// Computes the aggregate health state of a Command Center from its focus items.

export function calculateCommandCenterHealth(
  focusItems: OperationalFocusItemRow[]
): CommandCenterHealth {
  const openFocusItems     = focusItems.filter((i) => i.status !== "resolved" && i.status !== "dismissed").length;
  const criticalFocusItems = focusItems.filter((i) => i.priority === "critical" && i.status !== "resolved" && i.status !== "dismissed").length;
  const resolvedFocusItems = focusItems.filter((i) => i.status === "resolved").length;

  const scores = focusItems
    .filter((i) => i.status !== "resolved" && i.status !== "dismissed")
    .map((i) => i.focus_score);

  const averageFocusScore = scores.length > 0
    ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
    : 0;

  const overallPriority: OperationalPriority = calculateOverallPriority(scores);

  return {
    openFocusItems,
    criticalFocusItems,
    resolvedFocusItems,
    averageFocusScore,
    overallPriority,
  };
}
