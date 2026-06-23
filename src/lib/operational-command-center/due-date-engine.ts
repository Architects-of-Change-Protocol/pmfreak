import type { OperationalPriority } from "@/lib/db/database-contract";

// ─── Due Date Engine ──────────────────────────────────────────────────────────
//
// Calculates a recommended due date for a focus item based on its priority.
// Rules:
//   critical → 24h
//   high     → 48h
//   medium   → 7d
//   low      → 14d

const DUE_HOURS: Record<OperationalPriority, number> = {
  critical: 24,
  high:     48,
  medium:   7 * 24,
  low:      14 * 24,
};

export function calculateFocusDueDate(priority: OperationalPriority, from?: Date): string {
  const base = from ?? new Date();
  const hours = DUE_HOURS[priority];
  const due = new Date(base.getTime() + hours * 60 * 60 * 1000);
  return due.toISOString();
}
