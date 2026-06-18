// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Context Engine — Health
//
// Reports health metrics for the context engine.
// No AI. No ML. No scoring. No ranking. No prediction.
// ─────────────────────────────────────────────────────────────────────────────

import { assembleConstitutionalKnowledge } from "@/lib/constitutional-intelligence";
import { resolveContextFromSnapshot } from "./context-resolver";
import type {
  ConstitutionalContextHealth,
  ConstitutionalContextResult,
  ContextType,
} from "./types";
import { ALL_CONTEXT_TYPES } from "./types";

function failed<T>(error: string, failureClass = "query_failed"): ConstitutionalContextResult<T> {
  return { ok: false, error, failureClass };
}

function validUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─── getContextEngineHealth ───────────────────────────────────────────────────
// Computes health metrics by simulating context selection for each context type
// using the workspace + PM snapshot as the knowledge base.

export async function getContextEngineHealth(
  workspaceId: string,
  pmUserId: string
): Promise<ConstitutionalContextResult<ConstitutionalContextHealth>> {
  if (!validUuid(workspaceId)) return failed("workspaceId must be a UUID.", "validation_failed");
  if (!validUuid(pmUserId))    return failed("pmUserId must be a UUID.", "validation_failed");

  const snapshot = await assembleConstitutionalKnowledge(workspaceId, pmUserId);

  // Sample context selection per type to compute average metrics.
  // We use a zero-UUID placeholder — real IDs would yield real records.
  // This tells us the engine's capacity to resolve contexts from the snapshot.
  const SAMPLE_ID = "00000000-0000-0000-0000-000000000000";

  let totalRecords = 0;
  let totalEvidence = 0;
  let totalContradictions = 0;
  let contextCount = 0;

  const contextTypeBreakdown = Object.fromEntries(
    ALL_CONTEXT_TYPES.map((t) => [t, 0])
  ) as Record<ContextType, number>;

  // Use actual IDs from the snapshot as sample context targets
  const sampleIds: string[] = [];
  for (const r of [
    ...snapshot.organizationalMemory,
    ...snapshot.personalMemory,
    ...snapshot.decisionEffectiveness,
  ]) {
    const id = r["id"] as string | undefined;
    if (id && sampleIds.length < 5) sampleIds.push(id);
  }

  if (sampleIds.length === 0) sampleIds.push(SAMPLE_ID);

  for (const contextType of ALL_CONTEXT_TYPES) {
    for (const sampleId of sampleIds) {
      const resolved = resolveContextFromSnapshot(snapshot, contextType, sampleId, [], 100);
      const evidenceCount = resolved.evidence.length;

      const selectedIds = new Set(resolved.evidence.map((r) => r["id"] as string).filter(Boolean));
      const contradictionCount = snapshot.contradictions.filter(
        (c) => selectedIds.has(c.sourceAId) || selectedIds.has(c.sourceBId)
      ).length;

      totalRecords += resolved.memories.length + resolved.patterns.length + resolved.effectivenessRecords.length;
      totalEvidence += evidenceCount;
      totalContradictions += contradictionCount;
      contextCount++;
      contextTypeBreakdown[contextType]++;
    }
  }

  const divisor = Math.max(1, contextCount);

  return {
    ok: true,
    data: {
      contextCount,
      averageRecordsPerContext: totalRecords / divisor,
      averageEvidencePerContext: totalEvidence / divisor,
      averageContradictionsPerContext: totalContradictions / divisor,
      coverageMetrics: {
        totalContextsGenerated: contextCount,
        contextTypeBreakdown,
        averageMemoriesPerContext: (snapshot.organizationalMemory.length + snapshot.personalMemory.length) / divisor,
        averagePatternsPerContext: (snapshot.organizationalPatterns.length + snapshot.personalPatterns.length) / divisor,
        averageEffectivenessPerContext: (snapshot.decisionEffectiveness.length + snapshot.personalEffectiveness.length) / divisor,
        averageBridgesPerContext: snapshot.bridgeRelationships.length / divisor,
      },
    },
  };
}
