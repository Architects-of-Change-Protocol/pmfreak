// ─────────────────────────────────────────────────────────────────────────────
// Commitment Lifecycle Engine — State Machine
//
// Enforces valid transitions. Terminal states are irreversible.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentStatus } from "./types";
import { GOVERNANCE_COMMITMENT_TERMINAL_STATUSES } from "./types";

type Transition = Record<GovernanceCommitmentStatus, GovernanceCommitmentStatus[]>;

const ALLOWED_TRANSITIONS: Transition = {
  pending_acceptance: ["accepted", "rejected", "expired"],
  accepted:           ["active", "cancelled", "delegated"],
  active:             ["completed", "breached", "cancelled", "expired", "delegated"],
  delegated:          ["accepted", "active", "cancelled"],
  completed:          [],
  breached:           [],
  cancelled:          [],
  rejected:           [],
  expired:            [],
};

export function canTransition(
  from: GovernanceCommitmentStatus,
  to: GovernanceCommitmentStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: GovernanceCommitmentStatus): boolean {
  return GOVERNANCE_COMMITMENT_TERMINAL_STATUSES.includes(status);
}

export function transitionCommitmentStatus(
  current: GovernanceCommitmentStatus,
  next: GovernanceCommitmentStatus
): { ok: true } | { ok: false; error: string } {
  if (isTerminal(current)) {
    return { ok: false, error: `Status '${current}' is terminal and cannot be changed.` };
  }
  if (!canTransition(current, next)) {
    return {
      ok: false,
      error: `Cannot transition from '${current}' to '${next}'. Allowed: ${(ALLOWED_TRANSITIONS[current] ?? []).join(", ") || "none"}.`,
    };
  }
  return { ok: true };
}
