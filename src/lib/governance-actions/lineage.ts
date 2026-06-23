// ─────────────────────────────────────────────────────────────────────────────
// Governance Action Engine — Action Lineage
//
// Reconstructs the full provenance chain from artifact through action.
// ─────────────────────────────────────────────────────────────────────────────

import type { ActionLineage } from "./types";
import type { GovernanceActionRow } from "@/lib/db/database-contract";
import type { GovernanceSignalRow } from "@/lib/db/database-contract";

export function getActionLineage(
  action: GovernanceActionRow,
  signal: GovernanceSignalRow
): ActionLineage {
  return {
    actionId:   action.id,
    actionType: action.action_type as import("./types").GovernanceActionType,
    chain: [
      {
        layer:      "artifact",
        entityType: signal.signal_source,
        entityId:   signal.source_entity_id,
        label:      `Source artifact: ${signal.signal_source} (${signal.source_entity_id})`,
      },
      {
        layer:      "memory",
        entityType: "operational_memory",
        entityId:   null,
        label:      "Operational memory: observations accumulated over workspace lifecycle",
      },
      {
        layer:      "digest",
        entityType: "constitutional_digest",
        entityId:   null,
        label:      "Constitutional digest: synthesized governance intelligence",
      },
      {
        layer:      "learning_pattern",
        entityType: "learning_pattern",
        entityId:   null,
        label:      "Learning pattern: recurring governance behavior recognized",
      },
      {
        layer:      "recommendation",
        entityType: "constitutional_recommendation",
        entityId:   null,
        label:      "Recommendation: prior advisory generated from pattern",
      },
      {
        layer:      "signal",
        entityType: signal.signal_type,
        entityId:   signal.id,
        label:      `Signal: ${signal.title} (${signal.signal_type}, severity=${signal.severity})`,
      },
      {
        layer:      "action",
        entityType: action.action_type,
        entityId:   action.id,
        label:      `Action: ${action.title} (${action.action_type}, priority=${action.action_priority})`,
      },
    ],
  };
}
