// ─────────────────────────────────────────────────────────────────────────────
// Delegation Validation Engine
//
// Validates authority, delegation rights, and ownership rules.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentRow, GovernanceCommitmentDelegationRow } from "./types";
import type { DelegationValidationResult } from "./types";

export function validateCommitmentDelegation(input: {
  commitment: GovernanceCommitmentRow;
  delegatedBy: string;
  delegatedTo: string;
  existingDelegations: GovernanceCommitmentDelegationRow[];
}): DelegationValidationResult {
  const { commitment, delegatedBy, delegatedTo, existingDelegations } = input;

  // Only the current owner may delegate
  if (commitment.owner_id !== delegatedBy) {
    return {
      valid: false,
      reason: "Only the commitment owner may delegate it.",
    };
  }

  // Cannot delegate to yourself
  if (delegatedBy === delegatedTo) {
    return {
      valid: false,
      reason: "Cannot delegate a commitment to yourself.",
    };
  }

  // Cannot delegate if in a terminal state
  const terminalStatuses = ["completed", "breached", "cancelled", "expired", "rejected"];
  if (terminalStatuses.includes(commitment.status)) {
    return {
      valid: false,
      reason: `Cannot delegate a commitment in terminal status '${commitment.status}'.`,
    };
  }

  // Cannot delegate if already delegated and pending
  const activeDelegation = existingDelegations.find(
    (d) => d.status === "pending" || d.status === "accepted"
  );
  if (activeDelegation) {
    return {
      valid: false,
      reason: "Commitment already has an active delegation. Resolve it before delegating again.",
    };
  }

  return { valid: true, reason: "Delegation is valid." };
}
