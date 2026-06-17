import { getPlatformEvents, type PlatformEventRow } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MemoryEntry, MemoryEvidence, MemorySource } from "./types";

export type ResolvedMemorySources = {
  platformEvents: PlatformEventRow[];
  decisions: MemoryEvidence[];
  outcomes: MemoryEvidence[];
  unresolvedSources: MemorySource[];
};

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export async function resolveMemorySources(memory: MemoryEntry, sources: MemorySource[]): Promise<ResolvedMemorySources> {
  const supabase = await createSupabaseServerClient();
  const platformEventIds = sources.filter((source) => source.source_type === "platform_event").map((source) => source.source_id);
  const decisionIds = sources.filter((source) => source.source_type === "decision").map((source) => source.source_id);
  const outcomeIds = sources.filter((source) => source.source_type === "outcome").map((source) => source.source_id);

  const [auditEvents, platformEventsById, decisions, outcomes] = await Promise.all([
    getPlatformEvents({ workspaceId: memory.workspace_id, projectId: memory.project_id ?? undefined, correlationId: memory.id, limit: 100 }),
    platformEventIds.length ? supabase.from("platform_events").select("*").in("id", platformEventIds).returns<PlatformEventRow[]>() : Promise.resolve({ data: [] }),
    decisionIds.length ? supabase.from("project_decisions").select("*").in("id", decisionIds).returns<MemoryEvidence[]>() : Promise.resolve({ data: [] }),
    outcomeIds.length ? supabase.from("decision_outcomes").select("*").in("id", outcomeIds).returns<MemoryEvidence[]>() : Promise.resolve({ data: [] }),
  ]);

  const resolvedSourceIds = new Set<string>([
    ...(platformEventsById.data ?? []).map((event) => event.id),
    ...(decisions.data ?? []).map((decision) => decision.id).filter((id): id is string => typeof id === "string"),
    ...(outcomes.data ?? []).map((outcome) => outcome.id).filter((id): id is string => typeof id === "string"),
  ]);

  return {
    platformEvents: uniqueById([...(auditEvents.ok ? auditEvents.events : []), ...(platformEventsById.data ?? [])]),
    decisions: decisions.data ?? [],
    outcomes: outcomes.data ?? [],
    unresolvedSources: sources.filter((source) => !resolvedSourceIds.has(source.source_id)),
  };
}
