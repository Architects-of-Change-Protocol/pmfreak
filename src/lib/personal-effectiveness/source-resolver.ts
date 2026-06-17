import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PersonalEffectivenessRecord,
  PersonalEffectivenessSource,
} from "./types";

export type ResolvedPersonalEffectivenessSources = {
  platformEvents: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  decisionEffectiveness: Record<string, unknown>[];
  organizationalPatterns: Record<string, unknown>[];
  organizationalMemory: Record<string, unknown>[];
  personalMemory: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  outcomes: Record<string, unknown>[];
  unresolvedSources: PersonalEffectivenessSource[];
};

// Source types that map to tables this codebase currently has.
const RESOLVABLE_TYPES = new Set([
  "decision",
  "decision_effectiveness",
  "organizational_pattern",
  "organizational_memory",
  "personal_memory",
  "personal_pattern",
  "outcome",
  "platform_event",
]);

const TABLE_MAP: Record<string, string> = {
  decision: "project_decisions",
  decision_effectiveness: "decision_effectiveness",
  organizational_pattern: "organizational_patterns",
  organizational_memory: "organizational_memory_entries",
  personal_memory: "personal_pm_memory",
  personal_pattern: "personal_pm_patterns",
  outcome: "decision_outcomes",
  platform_event: "platform_events",
};

export async function resolvePersonalEffectivenessSources(
  _record: PersonalEffectivenessRecord,
  sources: PersonalEffectivenessSource[],
): Promise<ResolvedPersonalEffectivenessSources> {
  const supabase = await createSupabaseServerClient();

  const resolved: ResolvedPersonalEffectivenessSources = {
    platformEvents: [],
    decisions: [],
    decisionEffectiveness: [],
    organizationalPatterns: [],
    organizationalMemory: [],
    personalMemory: [],
    personalPatterns: [],
    outcomes: [],
    unresolvedSources: [],
  };

  // Group source IDs by type for batch fetching.
  const byType = new Map<string, string[]>();
  for (const s of sources) {
    if (!RESOLVABLE_TYPES.has(s.source_type)) {
      resolved.unresolvedSources.push(s);
      continue;
    }
    const ids = byType.get(s.source_type) ?? [];
    ids.push(s.source_id);
    byType.set(s.source_type, ids);
  }

  const fetches: Promise<void>[] = [];

  for (const [sourceType, ids] of byType.entries()) {
    const table = TABLE_MAP[sourceType];
    if (!table) {
      // Unknown table mapping — keep as unresolved for audit visibility.
      const unresolved = sources.filter((s) => s.source_type === sourceType);
      resolved.unresolvedSources.push(...unresolved);
      continue;
    }

    fetches.push(
      Promise.resolve(
      supabase
        .from(table)
        .select("*")
        .in("id", ids)
        .returns<Record<string, unknown>[]>()
        .then(({ data }: { data: Record<string, unknown>[] | null }) => {
          const rows = data ?? [];
          switch (sourceType) {
            case "platform_event":
              resolved.platformEvents.push(...rows);
              break;
            case "decision":
              resolved.decisions.push(...rows);
              break;
            case "decision_effectiveness":
              resolved.decisionEffectiveness.push(...rows);
              break;
            case "organizational_pattern":
              resolved.organizationalPatterns.push(...rows);
              break;
            case "organizational_memory":
              resolved.organizationalMemory.push(...rows);
              break;
            case "personal_memory":
              resolved.personalMemory.push(...rows);
              break;
            case "personal_pattern":
              resolved.personalPatterns.push(...rows);
              break;
            case "outcome":
              resolved.outcomes.push(...rows);
              break;
          }
        }),
      ),
    );
  }

  await Promise.all(fetches);
  return resolved;
}
