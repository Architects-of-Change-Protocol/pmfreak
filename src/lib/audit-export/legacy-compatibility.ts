/**
 * P2-20 — LEGACY decision-governance audit-export compatibility adapter.
 *
 * Source contract : `DecisionAuditPackage` from src/lib/decision-governance/types.ts,
 *                   produced by `exportDecisionAuditPackage(decisionId)` over the legacy
 *                   project_decisions / project_decision_evidence_links / decision_outcomes
 *                   bounded model.
 * Target contract : `LegacyDecisionAuditCompatibilityPackage` — a bounded, redacted
 *                   envelope that carries the legacy package through with its IDs intact
 *                   and states plainly what it is NOT.
 *
 * Why an envelope rather than a canonical mapping: `project_decisions` carries no
 * reference to any canonical P2 entity (`operational_decision_records`,
 * `material_action_proposals`, `execution_tasks`, `canonical_task_outcomes`,
 * `canonical_outcome_observations`). There is no stored link to follow, so no canonical
 * lineage can be produced for a legacy decision without fabricating provenance. The
 * adapter therefore reports an explicit compatibility gap instead — never a synthesised
 * chain, and never a claim that the legacy decision-centric shape IS the canonical PM
 * lineage.
 *
 * The legacy function itself is untouched: this module composes it, adds nothing to the
 * legacy model, writes nothing, and creates no dual-write path.
 */

import { exportDecisionAuditPackage } from "@/lib/decision-governance/service";
import type { Result } from "@/lib/decision-governance/types";
import {
  PRESERVED_AUDIT_FIELDS,
  REDACTED_CATEGORIES,
  redactAuditRecord,
} from "./redaction";
import {
  CANONICAL_AUDIT_EXPORT_FORMAT,
  LEGACY_DECISION_AUDIT_COMPATIBILITY_FORMAT,
  REDACTION_MARKER,
  type LegacyDecisionAuditCompatibilityPackage,
} from "./types";

export const LEGACY_COMPATIBILITY_GAPS = [
  "project_decisions holds no reference to operational_decision_records; the canonical Decision step cannot be established for this legacy record.",
  "No canonical Source, Raw Input, Normalized Event or Evidence provenance is reachable from this legacy record; none was synthesised.",
  "No canonical Material Action, governance evaluation, Task, Internal Execution, Outcome or Observation is reachable from this legacy record.",
  "decision_outcomes is a legacy outcome model. It is NOT a canonical_task_outcomes achievement and must not be read as one.",
  "Legacy platform events are carried through verbatim; their association to any canonical lineage is unestablished.",
] as const;

export type BuildLegacyCompatibilityOptions = {
  /** Test/replay seam. Defaults to now. */
  generatedAt?: string;
};

/**
 * Wraps the legacy audit export in the bounded compatibility envelope. Returns the legacy
 * `Result` failure verbatim when the legacy export fails, so existing failure classes and
 * error strings are preserved for existing consumers.
 */
export async function exportLegacyDecisionAuditCompatibilityPackage(
  decisionId: string,
  options: BuildLegacyCompatibilityOptions = {},
): Promise<Result<LegacyDecisionAuditCompatibilityPackage>> {
  const legacy = await exportDecisionAuditPackage(decisionId);
  if (!legacy.ok) return legacy as Result<LegacyDecisionAuditCompatibilityPackage>;

  const redactedKeys = new Set<string>();
  // IDs are inside the legacy payload and are preserved: redaction acts on secret-shaped
  // values and sensitive key names only, never on identifiers or timestamps.
  const legacyPackage = redactAuditRecord(
    legacy.data as unknown as Record<string, unknown>,
    redactedKeys,
  );

  return {
    ok: true,
    data: {
      exportFormat: LEGACY_DECISION_AUDIT_COMPATIBILITY_FORMAT,
      exportVersion: 1,
      generatedAt: options.generatedAt ?? new Date().toISOString(),
      legacyModel: "project_decisions",
      legacyDecisionId: legacy.data.decision.id,
      canonicalLineageSupported: false,
      canonicalExportFormat: CANONICAL_AUDIT_EXPORT_FORMAT,
      compatibilityGaps: [...LEGACY_COMPATIBILITY_GAPS],
      legacyPackage,
      redaction: {
        policyVersion: "pmfreak.audit-export-redaction.v1",
        strategy: "entity_field_allowlist_plus_bounded_recursive_value_redaction",
        marker: REDACTION_MARKER,
        redactedCategories: [...REDACTED_CATEGORIES],
        // The legacy package is carried through whole, so no column allowlist applies.
        withheldEntityFields: [],
        redactedPayloadKeys: [...redactedKeys].sort(),
        preservedAuditFields: [...PRESERVED_AUDIT_FIELDS],
      },
      notes: [
        "This is a bounded LEGACY compatibility representation of a project_decisions record. It is NOT the canonical PM operational lineage.",
        `The canonical, gap-aware PM lineage export is ${CANONICAL_AUDIT_EXPORT_FORMAT}, built from the verified operational-flow chain.`,
        "Legacy record identifiers are preserved verbatim. No canonical provenance was invented for them.",
      ],
    },
  };
}
