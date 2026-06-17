import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlatformEvents } from "@/lib/platform-events";
import type { PersonalPatternEvidence, PersonalPatternRecord, PersonalPatternSource } from "./types";

export type ResolvedPersonalPatternSources = {
  platformEvents: PersonalPatternEvidence[];
  decisions: PersonalPatternEvidence[];
  decisionEffectiveness: PersonalPatternEvidence[];
  organizationalPatterns: PersonalPatternEvidence[];
  organizationalMemory: PersonalPatternEvidence[];
  personalMemory: PersonalPatternEvidence[];
  outcomes: PersonalPatternEvidence[];
  unresolvedSources: PersonalPatternSource[];
};

export async function resolvePersonalPatternSources(
  pattern: PersonalPatternRecord,
  sources: PersonalPatternSource[],
): Promise<ResolvedPersonalPatternSources> {
  const supabase = await createSupabaseServerClient();

  const byType = (type: PersonalPatternSource["source_type"]) =>
    sources.filter((s) => s.source_type === type).map((s) => s.source_id);

  const eventIds = byType("platform_event");
  const decisionIds = byType("decision");
  const effectivenessIds = byType("decision_effectiveness");
  const orgPatternIds = byType("organizational_pattern");
  const orgMemoryIds = byType("organizational_memory");
  const personalMemoryIds = byType("personal_memory");
  const outcomeIds = byType("outcome");

  // Source types that map to known tables in this codebase.
  const knownTypes = new Set([
    "platform_event",
    "decision",
    "decision_effectiveness",
    "organizational_pattern",
    "organizational_memory",
    "personal_memory",
    "outcome",
  ]);

  const unresolvedSources = sources.filter((s) => !knownTypes.has(s.source_type));

  const [correlatedEvents, eventsById, decisions, effectiveness, orgPatterns, orgMemory, personalMem, outcomes] =
    await Promise.all([
      getPlatformEvents({ workspaceId: pattern.workspace_id, correlationId: pattern.id, limit: 100 }),
      eventIds.length
        ? supabase.from("platform_events").select("*").in("id", eventIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
      decisionIds.length
        ? supabase.from("project_decisions").select("*").in("id", decisionIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
      effectivenessIds.length
        ? supabase.from("decision_effectiveness").select("*").in("id", effectivenessIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
      orgPatternIds.length
        ? supabase.from("organizational_patterns").select("*").in("id", orgPatternIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
      orgMemoryIds.length
        ? supabase.from("organizational_memory").select("*").in("id", orgMemoryIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
      personalMemoryIds.length
        ? supabase.from("personal_pm_memory").select("*").in("id", personalMemoryIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
      outcomeIds.length
        ? supabase.from("decision_outcomes").select("*").in("id", outcomeIds).returns<PersonalPatternEvidence[]>()
        : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
    ]);

  type WithId = { id: string };
  const correlatedRows = correlatedEvents.ok
    ? (correlatedEvents as { ok: true; events: WithId[] }).events
    : ([] as WithId[]);
  const byIdRows = (eventsById.data ?? []) as WithId[];
  const uniqueEvents = [...new Map([...correlatedRows, ...byIdRows].map((e) => [e.id, e])).values()];

  return {
    platformEvents: uniqueEvents as PersonalPatternEvidence[],
    decisions: decisions.data ?? [],
    decisionEffectiveness: effectiveness.data ?? [],
    organizationalPatterns: orgPatterns.data ?? [],
    organizationalMemory: orgMemory.data ?? [],
    personalMemory: personalMem.data ?? [],
    outcomes: outcomes.data ?? [],
    unresolvedSources,
  };
}
