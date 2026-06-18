import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  IntelligenceBridgeRecord,
  IntelligenceBridgeSource,
  UnresolvedBridgeSource,
} from "./types";

export type ResolvedBridgeSources = {
  personalMemory: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  personalEffectiveness: Record<string, unknown>[];
  personalPatternCandidates: Record<string, unknown>[];
  organizationalMemory: Record<string, unknown>[];
  organizationalPatterns: Record<string, unknown>[];
  decisionEffectiveness: Record<string, unknown>[];
  patternCandidates: Record<string, unknown>[];
  events: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  outcomes: Record<string, unknown>[];
  unresolvedSources: UnresolvedBridgeSource[];
};

type SourceEntry = { sourceType: string; sourceId: string };

const SOURCE_TABLE_MAP: Record<string, string> = {
  personal_memory:           "personal_pm_memory",
  personal_pattern:          "personal_pm_patterns",
  personal_effectiveness:    "personal_pm_effectiveness",
  personal_pattern_candidate: "personal_pm_pattern_candidates",
  organizational_memory:     "organizational_memory",
  organizational_pattern:    "organizational_patterns",
  decision_effectiveness:    "decision_effectiveness",
  pattern_candidate:         "pattern_extraction_candidates",
  platform_event:            "platform_events",
  decision:                  "project_decisions",
  outcome:                   "decision_outcomes",
};

const RESULT_BUCKET_MAP: Record<string, keyof ResolvedBridgeSources> = {
  personal_memory:            "personalMemory",
  personal_pattern:           "personalPatterns",
  personal_effectiveness:     "personalEffectiveness",
  personal_pattern_candidate: "personalPatternCandidates",
  organizational_memory:      "organizationalMemory",
  organizational_pattern:     "organizationalPatterns",
  decision_effectiveness:     "decisionEffectiveness",
  pattern_candidate:          "patternCandidates",
  platform_event:             "events",
  decision:                   "decisions",
  outcome:                    "outcomes",
};

export async function resolveIntelligenceBridgeSources(
  bridge: IntelligenceBridgeRecord,
  additionalSources: IntelligenceBridgeSource[]
): Promise<ResolvedBridgeSources> {
  const result: ResolvedBridgeSources = {
    personalMemory: [],
    personalPatterns: [],
    personalEffectiveness: [],
    personalPatternCandidates: [],
    organizationalMemory: [],
    organizationalPatterns: [],
    decisionEffectiveness: [],
    patternCandidates: [],
    events: [],
    decisions: [],
    outcomes: [],
    unresolvedSources: [],
  };

  // Collect all sources: primary pair + additional
  const allSources: SourceEntry[] = [
    { sourceType: bridge.personal_source_type,       sourceId: bridge.personal_source_id },
    { sourceType: bridge.organizational_source_type, sourceId: bridge.organizational_source_id },
    ...additionalSources.map((s) => ({ sourceType: s.source_type, sourceId: s.source_id })),
  ];

  // Group by source_type
  const grouped = new Map<string, string[]>();
  for (const { sourceType, sourceId } of allSources) {
    if (!grouped.has(sourceType)) grouped.set(sourceType, []);
    grouped.get(sourceType)!.push(sourceId);
  }

  const supabase = await createSupabaseServerClient();

  for (const [sourceType, ids] of grouped.entries()) {
    const table = SOURCE_TABLE_MAP[sourceType];
    if (!table) {
      for (const sourceId of ids) {
        result.unresolvedSources.push({ sourceType, sourceId, reason: "unsupported_source_type" });
      }
      continue;
    }

    const bucket = RESULT_BUCKET_MAP[sourceType];
    if (!bucket) {
      for (const sourceId of ids) {
        result.unresolvedSources.push({ sourceType, sourceId, reason: "unsupported_source_type" });
      }
      continue;
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .in("id", ids)
        .returns<Record<string, unknown>[]>();

      if (error || !data) {
        for (const sourceId of ids) {
          result.unresolvedSources.push({ sourceType, sourceId, reason: "query_failed" });
        }
        continue;
      }

      const resolvedIds = new Set(data.map((row: Record<string, unknown>) => row["id"] as string));
      (result[bucket] as Record<string, unknown>[]).push(...data);

      for (const sourceId of ids) {
        if (!resolvedIds.has(sourceId)) {
          result.unresolvedSources.push({ sourceType, sourceId, reason: "record_not_found" });
        }
      }
    } catch {
      for (const sourceId of ids) {
        result.unresolvedSources.push({ sourceType, sourceId, reason: "query_failed" });
      }
    }
  }

  return result;
}
