// ─────────────────────────────────────────────────────────────────────────────
// Commitment Health Engine
//
// Calculates a 0–100 health score from commitment outcomes.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentRow } from "./types";
import type { CommitmentHealthScore } from "./types";

export function calculateCommitmentHealth(
  workspaceId: string,
  commitments: GovernanceCommitmentRow[],
  now: Date = new Date()
): CommitmentHealthScore {
  const total = commitments.length;

  let completed         = 0;
  let breached          = 0;
  let delegated         = 0;
  let active            = 0;
  let pendingAcceptance = 0;
  let overdue           = 0;

  for (const c of commitments) {
    if (c.status === "completed") completed++;
    if (c.status === "breached")  breached++;
    if (c.status === "delegated") delegated++;
    if (c.status === "active")    active++;
    if (c.status === "pending_acceptance") pendingAcceptance++;

    const dueDate = new Date(c.due_date);
    if (
      c.status !== "completed" &&
      c.status !== "cancelled" &&
      c.status !== "rejected" &&
      now > dueDate
    ) {
      overdue++;
    }
  }

  let score = 100;

  if (total > 0) {
    const completionRate = completed / total;
    const breachPenalty  = (breached / total) * 40;
    const overduePenalty = (overdue  / total) * 30;

    score = Math.round(completionRate * 100 - breachPenalty - overduePenalty);
    score = Math.max(0, Math.min(100, score));
  }

  return {
    workspaceId,
    score,
    totalCommitments: total,
    completed,
    breached,
    overdue,
    delegated,
    active,
    pendingAcceptance,
    calculatedAt: now.toISOString(),
  };
}
