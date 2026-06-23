// ─────────────────────────────────────────────────────────────────────────────
// Commitment Lineage
//
// Reconstructs the full chain: Artifact → Memory → Digest → Learning Pattern
// → Recommendation → Signal → Action → Commitment.
// ─────────────────────────────────────────────────────────────────────────────

import type { GovernanceCommitmentRow } from "./types";
import type { GovernanceActionRow } from "@/lib/db/database-contract";
import type { GovernanceSignalRow } from "@/lib/db/database-contract";
import type { CommitmentLineage } from "./types";

export function getCommitmentLineage(
  commitment: GovernanceCommitmentRow,
  action: GovernanceActionRow,
  signal: GovernanceSignalRow
): CommitmentLineage {
  return {
    commitmentId: commitment.id,
    chain: [
      {
        layer:      "artifact",
        entityType: "constitutional_artifact",
        entityId:   null,
        label:      "Constitutional Artifact (origin of knowledge)",
      },
      {
        layer:      "memory",
        entityType: "constitutional_memory_record",
        entityId:   null,
        label:      "Memory Record (contextual retention)",
      },
      {
        layer:      "digest",
        entityType: "constitutional_digest",
        entityId:   null,
        label:      "Digest (synthesized insight)",
      },
      {
        layer:      "learning_pattern",
        entityType: "constitutional_learning_pattern",
        entityId:   null,
        label:      "Learning Pattern (behavioral model)",
      },
      {
        layer:      "recommendation",
        entityType: "constitutional_recommendation",
        entityId:   null,
        label:      "Recommendation (prescribed intervention)",
      },
      {
        layer:      "signal",
        entityType: "governance_signal",
        entityId:   signal.id,
        label:      `Signal: ${signal.signal_type} — ${signal.title}`,
      },
      {
        layer:      "action",
        entityType: "governance_action",
        entityId:   action.id,
        label:      `Action: ${action.action_type} — ${action.title}`,
      },
      {
        layer:      "commitment",
        entityType: "governance_commitment",
        entityId:   commitment.id,
        label:      `Commitment: ${commitment.commitment_title}`,
      },
    ],
  };
}
