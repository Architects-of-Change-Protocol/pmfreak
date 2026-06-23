// ─────────────────────────────────────────────────────────────────────────────
// Breach Detection Engine
//
// Detects commitments where due_date < now AND status != completed.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentRow } from "./types";
import type { CommitmentBreachReport } from "./types";

const MS_PER_DAY = 86_400_000;

export function detectCommitmentBreaches(
  workspaceId: string,
  commitments: GovernanceCommitmentRow[],
  now: Date = new Date()
): CommitmentBreachReport {
  const breaches: CommitmentBreachReport["breaches"] = [];

  for (const c of commitments) {
    if (
      c.status === "completed" ||
      c.status === "cancelled" ||
      c.status === "rejected" ||
      c.status === "breached" ||
      c.status === "expired"
    ) {
      continue;
    }

    const dueDate = new Date(c.due_date);
    if (now <= dueDate) continue;

    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY);

    breaches.push({
      commitmentId: c.id,
      title:        c.commitment_title,
      ownerId:      c.owner_id,
      dueDate:      c.due_date,
      status:       c.status,
      daysOverdue,
    });
  }

  return {
    workspaceId,
    breaches,
    detectedAt: now.toISOString(),
  };
}
