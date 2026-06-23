import type { OperationalPriority } from "@/lib/db/database-contract";

// ─── Priority Engine ──────────────────────────────────────────────────────────
//
// Maps a focus score (0–100) to an operational priority level.
// Rules:
//   0–39   → low
//   40–64  → medium
//   65–84  → high
//   85–100 → critical

export function calculateOperationalPriority(focusScore: number): OperationalPriority {
  if (focusScore >= 85) return "critical";
  if (focusScore >= 65) return "high";
  if (focusScore >= 40) return "medium";
  return "low";
}

// Calculates the overall priority of a command center from its focus items' scores.
// Uses the maximum score among all items to determine the aggregate priority.
export function calculateOverallPriority(focusScores: number[]): OperationalPriority {
  if (focusScores.length === 0) return "low";
  const maxScore = Math.max(...focusScores);
  return calculateOperationalPriority(maxScore);
}

// Calculates the aggregate focus score for a command center (average of item scores).
export function calculateCommandCenterFocusScore(focusScores: number[]): number {
  if (focusScores.length === 0) return 0;
  const avg = focusScores.reduce((s, v) => s + v, 0) / focusScores.length;
  return Math.round(avg * 100) / 100;
}
