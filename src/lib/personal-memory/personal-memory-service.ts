import { createPlatformEvent } from "@/lib/platform-events";
import { getPlatformEvents } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PersonalMemoryCategory,
  PersonalMemoryConfidence,
  PersonalMemoryEventType,
  PersonalMemoryEvidence,
  PersonalMemoryExplanation,
  PersonalMemoryExport,
  PersonalMemoryHealth,
  PersonalMemoryLineage,
  PersonalMemoryObservation,
  PersonalMemoryRecord,
  PersonalMemoryResult,
  PersonalMemorySource,
  PersonalMemorySourceRelationship,
  PersonalMemorySourceType,
  PersonalMemoryStatus,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: PersonalMemoryCategory[] = [
  "decision_behavior", "risk_behavior", "stakeholder_behavior",
  "communication_behavior", "execution_behavior", "planning_behavior",
  "escalation_behavior", "governance_behavior", "delivery_behavior",
  "leadership_behavior", "other",
];

const CONFIDENCE_VALUES: PersonalMemoryConfidence[] = ["low", "medium", "high", "very_high"];

const SOURCE_TYPES: PersonalMemorySourceType[] = [
  "platform_event", "decision", "decision_effectiveness",
  "organizational_pattern", "organizational_memory", "outcome",
  "risk", "task", "milestone", "stakeholder",
];

const SOURCE_RELATIONSHIPS: PersonalMemorySourceRelationship[] = [
  "supports", "contradicts", "caused_by", "derived_from",
  "reviewed_during", "supersedes", "related_to",
];

const MEMORY_COLUMNS = "id,workspace_id,pm_user_id,memory_category,title,summary,confidence,status,created_at,updated_at,created_by,metadata";
const SOURCE_COLUMNS = "id,memory_id,source_type,source_id,relationship_type,created_at";
const OBSERVATION_COLUMNS = "id,memory_id,observation_summary,recorded_at,recorded_by,metadata";

// ─── Validation helpers ───────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}

function required(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validation<T>(error: string): PersonalMemoryResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass = "persistence_failed"): PersonalMemoryResult<T> {
  return { ok: false, error, failureClass };
}

// ─── Audit event emission ─────────────────────────────────────────────────────

async function emitPersonalMemoryEvent(
  memory: PersonalMemoryRecord,
  eventType: PersonalMemoryEventType,
  actorId: string | null | undefined,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalMemoryResult<PersonalMemoryRecord>> {
  const event = await createPlatformEvent({
    workspaceId: memory.workspace_id,
    actorId: actorId ?? memory.created_by,
    actorType: (actorId ?? memory.created_by) ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: (actorId ?? memory.created_by) ? "user_action" : "system",
    correlationId: correlationId ?? memory.id,
    causationId: causationId ?? null,
    rawReferenceTable: "personal_pm_memory",
    rawReferenceId: memory.id,
    learningEligible: false,
    visibility: "personal",
    sensitivityLevel: "confidential",
    eventPayload: {
      memoryId: memory.id,
      memoryCategory: memory.memory_category,
      status: memory.status,
      pmUserId: memory.pm_user_id,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: memory };
}

async function emitObservationEvent(
  memory: PersonalMemoryRecord,
  observationId: string,
  actorId: string | null | undefined,
  correlationId?: string | null,
): Promise<PersonalMemoryResult<PersonalMemoryObservation>> {
  const event = await createPlatformEvent({
    workspaceId: memory.workspace_id,
    actorId: actorId ?? memory.created_by,
    actorType: (actorId ?? memory.created_by) ? "user" : "system",
    eventType: "PERSONAL_MEMORY_OBSERVATION_RECORDED",
    eventCategory: "governance",
    source: (actorId ?? memory.created_by) ? "user_action" : "system",
    correlationId: correlationId ?? memory.id,
    causationId: null,
    rawReferenceTable: "personal_pm_memory_observations",
    rawReferenceId: observationId,
    learningEligible: false,
    visibility: "personal",
    sensitivityLevel: "confidential",
    eventPayload: {
      memoryId: memory.id,
      observationId,
      pmUserId: memory.pm_user_id,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  // Return placeholder; caller replaces with real observation row.
  return { ok: true, data: { id: observationId } as PersonalMemoryObservation };
}

// ─── Source validation ────────────────────────────────────────────────────────

function validateSources(
  sources: Array<{ sourceType: PersonalMemorySourceType; sourceId: string; relationshipType: PersonalMemorySourceRelationship }>,
): PersonalMemoryResult<true> {
  if (!sources.length) return validation("At least one source is required; every personal memory must point to evidence.");
  for (const s of sources) {
    if (!SOURCE_TYPES.includes(s.sourceType)) return validation(`sourceType must be one of: ${SOURCE_TYPES.join(", ")}.`);
    if (!validUuid(s.sourceId)) return validation("sourceId must be a UUID.");
    if (!SOURCE_RELATIONSHIPS.includes(s.relationshipType)) return validation(`relationshipType must be one of: ${SOURCE_RELATIONSHIPS.join(", ")}.`);
  }
  return { ok: true, data: true };
}

// ─── Privacy boundary enforcement ────────────────────────────────────────────

async function assertOwnership(memoryId: string, workspaceId: string, pmUserId: string): Promise<PersonalMemoryResult<PersonalMemoryRecord>> {
  if (!validUuid(memoryId)) return validation("memoryId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory")
    .select(MEMORY_COLUMNS)
    .eq("id", memoryId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .single<PersonalMemoryRecord>();
  if (error || !data) return failed("Personal memory not found or access denied.", "not_found");
  return { ok: true, data };
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

async function getSources(memoryId: string): Promise<PersonalMemoryResult<PersonalMemorySource[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory_sources")
    .select(SOURCE_COLUMNS)
    .eq("memory_id", memoryId)
    .order("created_at", { ascending: true })
    .returns<PersonalMemorySource[]>();
  if (error || !data) return failed("Unable to load memory sources.");
  return { ok: true, data };
}

async function getObservations(memoryId: string): Promise<PersonalMemoryResult<PersonalMemoryObservation[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("memory_id", memoryId)
    .order("recorded_at", { ascending: true })
    .returns<PersonalMemoryObservation[]>();
  if (error || !data) return failed("Unable to load memory observations.");
  return { ok: true, data };
}

async function resolvePersonalMemorySources(
  memory: PersonalMemoryRecord,
  sources: PersonalMemorySource[],
): Promise<{
  events: ReturnType<typeof getPlatformEvents> extends Promise<infer R> ? Exclude<R, { ok: false }> extends { events: infer E } ? E : never : never;
  decisions: PersonalMemoryEvidence[];
  outcomes: PersonalMemoryEvidence[];
  patterns: PersonalMemoryEvidence[];
  effectiveness: PersonalMemoryEvidence[];
}> {
  const supabase = await createSupabaseServerClient();

  const eventIds = sources.filter((s) => s.source_type === "platform_event").map((s) => s.source_id);
  const decisionIds = sources.filter((s) => s.source_type === "decision").map((s) => s.source_id);
  const outcomeIds = sources.filter((s) => s.source_type === "outcome").map((s) => s.source_id);
  const patternIds = sources.filter((s) => s.source_type === "organizational_pattern").map((s) => s.source_id);
  const effectivenessIds = sources.filter((s) => s.source_type === "decision_effectiveness").map((s) => s.source_id);

  const [correlatedEvents, eventsById, decisions, outcomes, patterns, effectiveness] = await Promise.all([
    getPlatformEvents({ workspaceId: memory.workspace_id, correlationId: memory.id, limit: 100 }),
    eventIds.length
      ? supabase.from("platform_events").select("*").in("id", eventIds).returns<PersonalMemoryEvidence[]>()
      : Promise.resolve({ data: [] as PersonalMemoryEvidence[] }),
    decisionIds.length
      ? supabase.from("project_decisions").select("*").in("id", decisionIds).returns<PersonalMemoryEvidence[]>()
      : Promise.resolve({ data: [] as PersonalMemoryEvidence[] }),
    outcomeIds.length
      ? supabase.from("decision_outcomes").select("*").in("id", outcomeIds).returns<PersonalMemoryEvidence[]>()
      : Promise.resolve({ data: [] as PersonalMemoryEvidence[] }),
    patternIds.length
      ? supabase.from("organizational_patterns").select("*").in("id", patternIds).returns<PersonalMemoryEvidence[]>()
      : Promise.resolve({ data: [] as PersonalMemoryEvidence[] }),
    effectivenessIds.length
      ? supabase.from("decision_effectiveness").select("*").in("id", effectivenessIds).returns<PersonalMemoryEvidence[]>()
      : Promise.resolve({ data: [] as PersonalMemoryEvidence[] }),
  ]);

  type PlatformEventLike = { id: string };
  const correlatedEventRows = correlatedEvents.ok ? (correlatedEvents as { ok: true; events: PlatformEventLike[] }).events : [];
  const byIdRows = (eventsById.data ?? []) as PlatformEventLike[];
  const uniqueEvents = [...new Map([...correlatedEventRows, ...byIdRows].map((e) => [e.id, e])).values()];

  return {
    events: uniqueEvents as never,
    decisions: decisions.data ?? [],
    outcomes: outcomes.data ?? [],
    patterns: patterns.data ?? [],
    effectiveness: effectiveness.data ?? [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createPersonalMemory(input: {
  workspaceId: string;
  pmUserId: string;
  memoryCategory: PersonalMemoryCategory;
  title: string;
  summary: string;
  confidence: PersonalMemoryConfidence;
  createdBy: string;
  metadata?: Record<string, unknown>;
  sources: Array<{ sourceType: PersonalMemorySourceType; sourceId: string; relationshipType: PersonalMemorySourceRelationship }>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PersonalMemoryResult<PersonalMemoryRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.pmUserId)) return validation("pmUserId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!CATEGORIES.includes(input.memoryCategory)) return validation(`memoryCategory must be one of: ${CATEGORIES.join(", ")}.`);
  if (!CONFIDENCE_VALUES.includes(input.confidence)) return validation(`confidence must be one of: ${CONFIDENCE_VALUES.join(", ")}.`);
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.summary)) return validation("summary is required.");
  const sourceValidation = validateSources(input.sources);
  if (!sourceValidation.ok) return sourceValidation;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory")
    .insert({
      workspace_id: input.workspaceId,
      pm_user_id: input.pmUserId,
      memory_category: input.memoryCategory,
      title: input.title.trim(),
      summary: input.summary.trim(),
      confidence: input.confidence,
      status: "active" as PersonalMemoryStatus,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(MEMORY_COLUMNS)
    .single<PersonalMemoryRecord>();
  if (error || !data) return failed("Unable to create personal memory.");

  const { error: sourceError } = await supabase.from("personal_pm_memory_sources").insert(
    input.sources.map((s) => ({
      memory_id: data.id,
      source_type: s.sourceType,
      source_id: s.sourceId,
      relationship_type: s.relationshipType,
    })),
  );
  if (sourceError) return failed("Unable to attach memory sources.");

  return emitPersonalMemoryEvent(data, "PERSONAL_MEMORY_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function getPersonalMemory(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalMemoryResult<PersonalMemoryRecord>> {
  return assertOwnership(memoryId, workspaceId, pmUserId);
}

export async function listPersonalMemory(
  workspaceId: string,
  pmUserId: string,
  filter?: { status?: PersonalMemoryStatus; category?: PersonalMemoryCategory },
): Promise<PersonalMemoryResult<PersonalMemoryRecord[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("personal_pm_memory")
    .select(MEMORY_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .order("updated_at", { ascending: false });
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.category) query = query.eq("memory_category", filter.category);
  const { data, error } = await query.returns<PersonalMemoryRecord[]>();
  if (error || !data) return failed("Unable to list personal memory.");
  return { ok: true, data };
}

export async function updatePersonalMemory(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
  input: {
    title?: string;
    summary?: string;
    confidence?: PersonalMemoryConfidence;
    metadata?: Record<string, unknown>;
    actorId: string;
    correlationId?: string | null;
    causationId?: string | null;
  },
): Promise<PersonalMemoryResult<PersonalMemoryRecord>> {
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  const current = await assertOwnership(memoryId, workspaceId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "frozen") return failed("Frozen memories cannot be edited; archive them instead.", "governance_violation");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    if (!required(input.title)) return validation("title cannot be empty.");
    patch.title = input.title.trim();
  }
  if (input.summary !== undefined) {
    if (!required(input.summary)) return validation("summary cannot be empty.");
    patch.summary = input.summary.trim();
  }
  if (input.confidence !== undefined) {
    if (!CONFIDENCE_VALUES.includes(input.confidence)) return validation(`confidence must be one of: ${CONFIDENCE_VALUES.join(", ")}.`);
    patch.confidence = input.confidence;
  }
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory")
    .update(patch)
    .eq("id", memoryId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .select(MEMORY_COLUMNS)
    .single<PersonalMemoryRecord>();
  if (error || !data) return failed("Unable to update personal memory.");
  return emitPersonalMemoryEvent(data, "PERSONAL_MEMORY_UPDATED", input.actorId, input.correlationId, input.causationId);
}

async function setPersonalMemoryStatus(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
  nextStatus: "archived" | "frozen" | "deprecated",
  eventType: PersonalMemoryEventType,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalMemoryResult<PersonalMemoryRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await assertOwnership(memoryId, workspaceId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "frozen" && nextStatus !== "archived") {
    return failed("Frozen memories can only be archived.", "governance_violation");
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", memoryId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .select(MEMORY_COLUMNS)
    .single<PersonalMemoryRecord>();
  if (error || !data) return failed(`Unable to ${nextStatus} personal memory.`);
  return emitPersonalMemoryEvent(data, eventType, actorId, correlationId, causationId);
}

export const archivePersonalMemory = (
  memoryId: string, workspaceId: string, pmUserId: string, actorId: string,
  correlationId?: string | null, causationId?: string | null,
) => setPersonalMemoryStatus(memoryId, workspaceId, pmUserId, "archived", "PERSONAL_MEMORY_ARCHIVED", actorId, correlationId, causationId);

export const freezePersonalMemory = (
  memoryId: string, workspaceId: string, pmUserId: string, actorId: string,
  correlationId?: string | null, causationId?: string | null,
) => setPersonalMemoryStatus(memoryId, workspaceId, pmUserId, "frozen", "PERSONAL_MEMORY_FROZEN", actorId, correlationId, causationId);

export const deprecatePersonalMemory = (
  memoryId: string, workspaceId: string, pmUserId: string, actorId: string,
  correlationId?: string | null, causationId?: string | null,
) => setPersonalMemoryStatus(memoryId, workspaceId, pmUserId, "deprecated", "PERSONAL_MEMORY_DEPRECATED", actorId, correlationId, causationId);

export async function deletePersonalMemory(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalMemoryResult<{ id: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await assertOwnership(memoryId, workspaceId, pmUserId);
  if (!current.ok) return current as PersonalMemoryResult<{ id: string }>;
  if (current.data.status === "frozen") return failed("Frozen memories cannot be deleted; archive them instead.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personal_pm_memory")
    .delete()
    .eq("id", memoryId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId);
  if (error) return failed("Unable to delete personal memory.");

  const emitted = await emitPersonalMemoryEvent(current.data, "PERSONAL_MEMORY_DELETED", actorId, correlationId, causationId);
  if (!emitted.ok) return emitted as PersonalMemoryResult<{ id: string }>;
  return { ok: true, data: { id: memoryId } };
}

export async function recordObservation(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
  input: {
    observationSummary: string;
    recordedBy: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  },
): Promise<PersonalMemoryResult<PersonalMemoryObservation>> {
  if (!validUuid(input.recordedBy)) return validation("recordedBy must be a UUID.");
  if (!required(input.observationSummary)) return validation("observationSummary is required.");

  const memory = await assertOwnership(memoryId, workspaceId, pmUserId);
  if (!memory.ok) return memory as PersonalMemoryResult<PersonalMemoryObservation>;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_memory_observations")
    .insert({
      memory_id: memoryId,
      observation_summary: input.observationSummary.trim(),
      recorded_by: input.recordedBy,
      metadata: input.metadata ?? {},
    })
    .select(OBSERVATION_COLUMNS)
    .single<PersonalMemoryObservation>();
  if (error || !data) return failed("Unable to record observation.");

  const emitted = await emitObservationEvent(memory.data, data.id, input.recordedBy, input.correlationId);
  if (!emitted.ok) return emitted;
  return { ok: true, data };
}

export async function explainPersonalMemory(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalMemoryResult<PersonalMemoryExplanation>> {
  const memory = await assertOwnership(memoryId, workspaceId, pmUserId);
  if (!memory.ok) return memory as PersonalMemoryResult<PersonalMemoryExplanation>;

  const [observations, sources] = await Promise.all([
    getObservations(memoryId),
    getSources(memoryId),
  ]);
  if (!observations.ok) return observations as PersonalMemoryResult<PersonalMemoryExplanation>;
  if (!sources.ok) return sources as PersonalMemoryResult<PersonalMemoryExplanation>;

  const resolved = await resolvePersonalMemorySources(memory.data, sources.data);

  return {
    ok: true,
    data: {
      memory: memory.data,
      observations: observations.data,
      sources: sources.data,
      supportingEvents: resolved.events as never,
      supportingDecisions: resolved.decisions,
      supportingOutcomes: resolved.outcomes,
      supportingPatterns: resolved.patterns,
      supportingEffectiveness: resolved.effectiveness,
    },
  };
}

export async function buildPersonalMemoryLineage(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalMemoryResult<PersonalMemoryLineage>> {
  const explanation = await explainPersonalMemory(memoryId, workspaceId, pmUserId);
  if (!explanation.ok) return explanation as PersonalMemoryResult<PersonalMemoryLineage>;
  const { memory, observations, sources, supportingEvents, supportingDecisions, supportingOutcomes, supportingPatterns, supportingEffectiveness } = explanation.data;
  return {
    ok: true,
    data: {
      memory,
      observations,
      sources,
      events: supportingEvents,
      decisions: supportingDecisions,
      outcomes: supportingOutcomes,
      patterns: supportingPatterns,
      effectiveness: supportingEffectiveness,
    },
  };
}

export async function exportPersonalMemory(
  memoryId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalMemoryResult<PersonalMemoryExport>> {
  const lineageResult = await buildPersonalMemoryLineage(memoryId, workspaceId, pmUserId);
  if (!lineageResult.ok) return lineageResult as PersonalMemoryResult<PersonalMemoryExport>;
  const sources = await getSources(memoryId);
  if (!sources.ok) return sources as PersonalMemoryResult<PersonalMemoryExport>;
  const observations = await getObservations(memoryId);
  if (!observations.ok) return observations as PersonalMemoryResult<PersonalMemoryExport>;

  return {
    ok: true,
    data: {
      memory: lineageResult.data.memory,
      observations: observations.data,
      sources: sources.data,
      lineage: lineageResult.data,
      exportedAt: new Date().toISOString(),
    },
  };
}

export async function getPersonalMemoryHealth(
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalMemoryResult<PersonalMemoryHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const memories = await listPersonalMemory(workspaceId, pmUserId);
  if (!memories.ok) return memories as PersonalMemoryResult<PersonalMemoryHealth>;

  const supabase = await createSupabaseServerClient();
  const ids = memories.data.map((m) => m.id);

  const [sourcesResult, observationsResult] = await Promise.all([
    ids.length
      ? supabase.from("personal_pm_memory_sources").select(SOURCE_COLUMNS).in("memory_id", ids).returns<PersonalMemorySource[]>()
      : Promise.resolve({ data: [] as PersonalMemorySource[] }),
    ids.length
      ? supabase.from("personal_pm_memory_observations").select(OBSERVATION_COLUMNS).in("memory_id", ids).returns<PersonalMemoryObservation[]>()
      : Promise.resolve({ data: [] as PersonalMemoryObservation[] }),
  ]);

  const sources = sourcesResult.data ?? [];
  const observations = observationsResult.data ?? [];

  const total = memories.data.length;
  const divisor = total || 1;
  const sourceMemoryIds = new Set(sources.map((s) => s.memory_id));
  const validLineageIds = new Set(
    sources.filter((s) => Boolean(s.source_type && s.source_id && s.relationship_type)).map((s) => s.memory_id),
  );

  return {
    ok: true,
    data: {
      activeCount: memories.data.filter((m) => m.status === "active").length,
      archivedCount: memories.data.filter((m) => m.status === "archived").length,
      frozenCount: memories.data.filter((m) => m.status === "frozen").length,
      deprecatedCount: memories.data.filter((m) => m.status === "deprecated").length,
      observationCount: observations.length,
      sourceCoverage: Math.min(1, Math.max(0, sourceMemoryIds.size / divisor)),
      lineageCoverage: Math.min(1, Math.max(0, validLineageIds.size / divisor)),
    },
  };
}
