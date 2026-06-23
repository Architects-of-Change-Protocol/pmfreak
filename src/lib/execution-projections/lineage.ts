import type { ExecutionProjectionRow } from "./types";
import type { GovernanceCommitmentRow, GovernanceActionRow, GovernanceSignalRow } from "@/lib/db/database-contract";
import type { ProjectionLineage } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Projection Lineage
//
// Reconstructs the full constitutional chain:
// Artifact → Memory → Digest → Learning Pattern → Recommendation
// → Signal → Action → Commitment → Execution Projection
// ─────────────────────────────────────────────────────────────────────────────

export function getExecutionProjectionLineage(
  projection:  ExecutionProjectionRow,
  commitment:  GovernanceCommitmentRow,
  action:      GovernanceActionRow,
  signal:      GovernanceSignalRow
): ProjectionLineage {
  return {
    projectionId: projection.id,
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
      {
        layer:      "execution_projection",
        entityType: "execution_projection",
        entityId:   projection.id,
        label:      `Projection: ${projection.projection_title}`,
      },
    ],
  };
}
