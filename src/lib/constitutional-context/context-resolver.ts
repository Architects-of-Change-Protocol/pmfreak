// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Context Engine — Context Resolver
//
// Selects records from the constitutional knowledge base using only:
//   - explicit IDs
//   - explicit relationships
//   - explicit lineage
//   - bridge relationships
//   - direct references
//   - workspace scope
//   - pm scope
//
// No semantic similarity. No embeddings. No NLP. No vector search.
// No fuzzy matching. No scoring. No ranking.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConstitutionalIntelligenceSnapshot } from "@/lib/constitutional-intelligence";
import type { ContextType, ConstitutionalContextSelectionReason } from "./types";

// ─── Reference field names per context type ───────────────────────────────────
// Records referencing a context carry these fields. We match by explicit value.

const CONTEXT_REFERENCE_FIELDS: Record<ContextType, string[]> = {
  "decision":          ["decision_id", "context_id", "reference_id", "source_id"],
  "project":           ["project_id", "context_id", "reference_id", "source_id"],
  "stakeholder":       ["stakeholder_id", "context_id", "reference_id", "source_id"],
  "risk":              ["risk_id", "context_id", "reference_id", "source_id"],
  "milestone":         ["milestone_id", "context_id", "reference_id", "source_id"],
  "task":              ["task_id", "context_id", "reference_id", "source_id"],
  "escalation":        ["escalation_id", "context_id", "reference_id", "source_id"],
  "meeting":           ["meeting_id", "context_id", "reference_id", "source_id"],
  "outcome":           ["outcome_id", "context_id", "reference_id", "source_id"],
  "governance-review": ["review_id", "context_id", "reference_id", "source_id"],
};

export type ContextResolverResult = {
  memories: Record<string, unknown>[];
  patterns: Record<string, unknown>[];
  effectivenessRecords: Record<string, unknown>[];
  bridgeRelationships: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  selectionReasons: ConstitutionalContextSelectionReason[];
};

// ─── Record matcher ───────────────────────────────────────────────────────────
// Returns the reason if the record explicitly references one of the target IDs.
// Returns null if no explicit reference is found.

function matchRecord(
  record: Record<string, unknown>,
  targetIds: Set<string>,
  referenceFields: string[],
  recordType: string
): ConstitutionalContextSelectionReason | null {
  const id = record["id"] as string | undefined;
  if (!id) return null;

  // Direct ID match
  if (targetIds.has(id)) {
    return {
      recordType,
      recordId: id,
      reason: "direct_id_match",
      matchedField: "id",
      matchedValue: id,
    };
  }

  // Reference field match
  for (const field of referenceFields) {
    const value = record[field];
    if (typeof value === "string" && targetIds.has(value)) {
      return {
        recordType,
        recordId: id,
        reason: "reference_field_match",
        matchedField: field,
        matchedValue: value,
      };
    }
    // Support array-type reference fields (e.g. related_ids, source_ids)
    if (Array.isArray(value)) {
      for (const v of value) {
        if (typeof v === "string" && targetIds.has(v)) {
          return {
            recordType,
            recordId: id,
            reason: "reference_array_match",
            matchedField: field,
            matchedValue: v,
          };
        }
      }
    }
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveContextFromSnapshot(
  snapshot: ConstitutionalIntelligenceSnapshot,
  contextType: ContextType,
  contextId: string,
  relatedIds: string[],
  maxResults: number
): ContextResolverResult {
  const targetIds = new Set<string>([contextId, ...relatedIds]);
  const referenceFields = CONTEXT_REFERENCE_FIELDS[contextType];
  const selectionReasons: ConstitutionalContextSelectionReason[] = [];

  function selectFromCollection(
    collection: Record<string, unknown>[],
    recordType: string
  ): Record<string, unknown>[] {
    const selected: Record<string, unknown>[] = [];
    for (const record of collection) {
      if (selected.length >= maxResults) break;
      const reason = matchRecord(record, targetIds, referenceFields, recordType);
      if (reason) {
        selected.push(record);
        selectionReasons.push(reason);
      }
    }
    return selected;
  }

  const memories = [
    ...selectFromCollection(snapshot.organizationalMemory, "organizational_memory"),
    ...selectFromCollection(snapshot.personalMemory, "personal_memory"),
  ];

  const patterns = [
    ...selectFromCollection(snapshot.organizationalPatterns, "organizational_pattern"),
    ...selectFromCollection(snapshot.personalPatterns, "personal_pattern"),
    ...selectFromCollection(snapshot.patternCandidates, "pattern_candidate"),
    ...selectFromCollection(snapshot.personalPatternCandidates, "personal_pattern_candidate"),
  ];

  const effectivenessRecords = [
    ...selectFromCollection(snapshot.decisionEffectiveness, "decision_effectiveness"),
    ...selectFromCollection(snapshot.personalEffectiveness, "personal_effectiveness"),
  ];

  const bridgeRelationships = selectFromCollection(
    snapshot.bridgeRelationships,
    "bridge_relationship"
  );

  // Evidence = all selected records combined
  const evidence: Record<string, unknown>[] = [
    ...memories,
    ...patterns,
    ...effectivenessRecords,
    ...bridgeRelationships,
  ];

  return {
    memories,
    patterns,
    effectivenessRecords,
    bridgeRelationships,
    evidence,
    selectionReasons,
  };
}

export { CONTEXT_REFERENCE_FIELDS };
