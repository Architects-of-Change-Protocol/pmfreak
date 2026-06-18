// ─────────────────────────────────────────────────────────────────────────────
// Constitutional Intelligence — Source Resolver
//
// Resolves existing records by explicit IDs, explicit relationships, and
// explicit lineage only. No semantic matching. No embeddings. No fuzzy search.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResolvedConstitutionalSources = {
  organizationalMemory: Record<string, unknown>[];
  organizationalPatterns: Record<string, unknown>[];
  decisionEffectiveness: Record<string, unknown>[];
  patternCandidates: Record<string, unknown>[];
  personalMemory: Record<string, unknown>[];
  personalPatterns: Record<string, unknown>[];
  personalEffectiveness: Record<string, unknown>[];
  personalPatternCandidates: Record<string, unknown>[];
  bridgeRelationships: Record<string, unknown>[];
};

const SOURCE_TABLE_MAP: Record<string, string> = {
  organizational_memory:       "organizational_memory",
  organizational_pattern:      "organizational_patterns",
  decision_effectiveness:      "decision_effectiveness",
  pattern_candidate:           "pattern_extraction_candidates",
  personal_memory:             "personal_pm_memory",
  personal_pattern:            "personal_pm_patterns",
  personal_effectiveness:      "personal_pm_effectiveness",
  personal_pattern_candidate:  "personal_pm_pattern_candidates",
  bridge_relationship:         "intelligence_bridge_links",
};

const RESULT_BUCKET_MAP: Record<string, keyof ResolvedConstitutionalSources> = {
  organizational_memory:       "organizationalMemory",
  organizational_pattern:      "organizationalPatterns",
  decision_effectiveness:      "decisionEffectiveness",
  pattern_candidate:           "patternCandidates",
  personal_memory:             "personalMemory",
  personal_pattern:            "personalPatterns",
  personal_effectiveness:      "personalEffectiveness",
  personal_pattern_candidate:  "personalPatternCandidates",
  bridge_relationship:         "bridgeRelationships",
};

export async function resolveByWorkspace(
  workspaceId: string,
  pmUserId: string
): Promise<ResolvedConstitutionalSources> {
  const supabase = await createSupabaseServerClient();

  const result: ResolvedConstitutionalSources = {
    organizationalMemory: [],
    organizationalPatterns: [],
    decisionEffectiveness: [],
    patternCandidates: [],
    personalMemory: [],
    personalPatterns: [],
    personalEffectiveness: [],
    personalPatternCandidates: [],
    bridgeRelationships: [],
  };

  type R = { data: Record<string, unknown>[] | null };
  await Promise.all([
    // Organizational — scoped to workspace
    supabase.from("organizational_memory").select("*").eq("workspace_id", workspaceId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.organizationalMemory = r.data ?? []; }),

    supabase.from("organizational_patterns").select("*").eq("workspace_id", workspaceId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.organizationalPatterns = r.data ?? []; }),

    supabase.from("decision_effectiveness").select("*").eq("workspace_id", workspaceId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.decisionEffectiveness = r.data ?? []; }),

    supabase.from("pattern_extraction_candidates").select("*").eq("workspace_id", workspaceId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.patternCandidates = r.data ?? []; }),

    // Personal — scoped to workspace + pm_user_id
    supabase.from("personal_pm_memory").select("*").eq("workspace_id", workspaceId).eq("pm_user_id", pmUserId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.personalMemory = r.data ?? []; }),

    supabase.from("personal_pm_patterns").select("*").eq("workspace_id", workspaceId).eq("pm_user_id", pmUserId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.personalPatterns = r.data ?? []; }),

    supabase.from("personal_pm_effectiveness").select("*").eq("workspace_id", workspaceId).eq("pm_user_id", pmUserId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.personalEffectiveness = r.data ?? []; }),

    supabase.from("personal_pm_pattern_candidates").select("*").eq("workspace_id", workspaceId).eq("pm_user_id", pmUserId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.personalPatternCandidates = r.data ?? []; }),

    supabase.from("intelligence_bridge_links").select("*").eq("workspace_id", workspaceId).eq("pm_user_id", pmUserId)
      .returns<Record<string, unknown>[]>()
      .then((r: R) => { result.bridgeRelationships = r.data ?? []; }),
  ]);

  return result;
}

export async function resolveByExplicitIds(
  ids: { sourceType: string; sourceId: string }[]
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const grouped = new Map<string, string[]>();
  for (const { sourceType, sourceId } of ids) {
    if (!grouped.has(sourceType)) grouped.set(sourceType, []);
    grouped.get(sourceType)!.push(sourceId);
  }

  const resolved: Record<string, unknown>[] = [];
  await Promise.all(
    Array.from(grouped.entries()).map(async ([sourceType, sourceIds]) => {
      const table = SOURCE_TABLE_MAP[sourceType];
      if (!table) return;
      const { data } = await supabase.from(table).select("*").in("id", sourceIds)
        .returns<Record<string, unknown>[]>();
      if (data) resolved.push(...data);
    })
  );
  return resolved;
}

export { SOURCE_TABLE_MAP, RESULT_BUCKET_MAP };
