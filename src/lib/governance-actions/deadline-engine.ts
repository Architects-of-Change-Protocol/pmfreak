// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Deadline Engine
//
// Calculates recommended due dates based on action priority.
// critical → 24h, high → 48h, medium → 7d, low → 14d
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceActionPriority } from "./types";

const PRIORITY_HOURS: Record<GovernanceActionPriority, number> = {
  critical: 24,
  high:     48,
  medium:   7 * 24,
  low:      14 * 24,
};

export function calculateRecommendedDueDate(
  priority: GovernanceActionPriority,
  fromDate?: Date
): string {
  const base = fromDate ?? new Date();
  const hours = PRIORITY_HOURS[priority];
  const due = new Date(base.getTime() + hours * 60 * 60 * 1000);
  return due.toISOString();
}

export function deadlineHoursForPriority(priority: GovernanceActionPriority): number {
  return PRIORITY_HOURS[priority];
}
