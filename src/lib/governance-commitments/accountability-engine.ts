// ─────────────────────────────────────────────────────────────────────────────
// Accountability Engine
//
// Answers: who accepted, are they overdue, how late are they?
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentRow } from "./types";
import type { CommitmentAccountability } from "./types";

const MS_PER_DAY = 86_400_000;

export function calculateCommitmentAccountability(
  commitment: GovernanceCommitmentRow,
  now: Date = new Date()
): CommitmentAccountability {
  const dueDate = new Date(commitment.due_date);
  const overdue =
    commitment.status !== "completed" &&
    commitment.status !== "cancelled" &&
    commitment.status !== "rejected" &&
    now > dueDate;

  const daysLate = overdue
    ? Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY)
    : 0;

  return {
    commitmentId: commitment.id,
    owner:        commitment.owner_id,
    accepted:     commitment.accepted_at !== null,
    completed:    commitment.status === "completed",
    overdue,
    daysLate,
    status:       commitment.status,
  };
}
