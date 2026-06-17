import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PatternCategory,
  PatternConfidence,
  PatternEvidence,
  PatternEventType,
  PatternExplanation,
  PatternExport,
  PatternHealth,
  PatternObservation,
  PatternRecord,
  PatternResult,
  PatternSource,
  PatternSourceRelationship,
  PatternSourceType,
  PatternStatus,
} from "./types";
import { PATTERN_VALIDATION_THRESHOLD } from "./types";

const categories: PatternCategory[] = [
  "risk_pattern", "decision_pattern", "schedule_pattern", "stakeholder_pattern",
  "delivery_pattern", "resource_pattern", "dependency_pattern", "governance_pattern",
  "execution_pattern", "memory_pattern", "other",
];
const statuses: PatternStatus[] = ["candidate", "validated", "deprecated", "archived"];
const confidenceValues: PatternConfidence[] = ["low", "medium", "high", "very_high"];
const sourceTypes: PatternSourceType[] = [
  "organizational_memory", "platform_event", "decision", "outcome",
  "risk", "task", "milestone", "dependency", "stakeholder",
];
const sourceRelationships: PatternSourceRelationship[] = [
  "supports", "contradicts", "caused_by", "derived_from", "reviewed_during", "supersedes", "related_to",
];

const patternColumns = "id,workspace_id,pattern_category,status,confidence,title,summary,observation_count,created_at,updated_at,created_by,metadata";
const sourceColumns = "id,pattern_id,source_type,source_id,relationship_type,created_at";
const observationColumns = "id,pattern_id,source_type,source_id,observation_summary,recorded_at";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }
function validation<T>(error: string): PatternResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function failed<T>(error: string, failureClass = "persistence_failed"): PatternResult<T> { return { ok: false, error, failureClass }; }

async function emitPatternEvent(
  pattern: PatternRecord,
  eventType: PatternEventType,
  actorId: string | null | undefined,
  correlationId?: string | null,
  causationId?: string | null,
  extra: Record<string, unknown> = {},
): Promise<PatternResult<PatternRecord>> {
  const event = await createPlatformEvent({
    workspaceId: pattern.workspace_id,
    actorId: actorId ?? pattern.created_by,
    actorType: (actorId ?? pattern.created_by) ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: (actorId ?? pattern.created_by) ? "user_action" : "system",
    correlationId: correlationId ?? pattern.id,
    causationId: causationId ?? null,
    rawReferenceTable: "organizational_patterns",
    rawReferenceId: pattern.id,
    learningEligible: false,
    eventPayload: {
      patternId: pattern.id,
      patternCategory: pattern.pattern_category,
      status: pattern.status,
      observationCount: pattern.observation_count,
      ...extra,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: pattern };
}

function validateSources(
  sources: Array<{ sourceType: PatternSourceType; sourceId: string; relationshipType: PatternSourceRelationship }>,
): PatternResult<true> {
  if (!sources.length) return validation("At least one source is required; every pattern must point to evidence.");
  for (const s of sources) {
    if (!sourceTypes.includes(s.sourceType)) return validation(`sourceType must be one of: ${sourceTypes.join(", ")}.`);
    if (!validUuid(s.sourceId)) return validation("sourceId must be a UUID.");
    if (!sourceRelationships.includes(s.relationshipType)) return validation(`relationshipType must be one of: ${sourceRelationships.join(", ")}.`);
  }
  return { ok: true, data: true };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createPattern(input: {
  workspaceId: string;
  patternCategory: PatternCategory;
  confidence: PatternConfidence;
  title: string;
  summary: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
  sources: Array<{ sourceType: PatternSourceType; sourceId: string; relationshipType: PatternSourceRelationship }>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PatternResult<PatternRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!categories.includes(input.patternCategory)) return validation(`patternCategory must be one of: ${categories.join(", ")}.`);
  if (!confidenceValues.includes(input.confidence)) return validation(`confidence must be one of: ${confidenceValues.join(", ")}.`);
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.summary)) return validation("summary is required.");
  const sv = validateSources(input.sources);
  if (!sv.ok) return sv;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_patterns")
    .insert({
      workspace_id: input.workspaceId,
      pattern_category: input.patternCategory,
      confidence: input.confidence,
      title: input.title.trim(),
      summary: input.summary.trim(),
      status: "candidate",
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(patternColumns)
    .single<PatternRecord>();
  if (error || !data) return failed("Unable to create pattern.");

  const { error: sourceError } = await supabase
    .from("organizational_pattern_sources")
    .insert(input.sources.map((s) => ({ pattern_id: data.id, source_type: s.sourceType, source_id: s.sourceId, relationship_type: s.relationshipType })));
  if (sourceError) return failed("Unable to attach pattern sources.");

  return emitPatternEvent(data, "PATTERN_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function getPattern(patternId: string): Promise<PatternResult<PatternRecord>> {
  if (!validUuid(patternId)) return validation("patternId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_patterns")
    .select(patternColumns)
    .eq("id", patternId)
    .single<PatternRecord>();
  if (error || !data) return failed("Pattern not found.", "not_found");
  return { ok: true, data };
}

export async function listPatterns(workspaceId: string): Promise<PatternResult<PatternRecord[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_patterns")
    .select(patternColumns)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .returns<PatternRecord[]>();
  if (error || !data) return failed("Unable to list patterns.");
  return { ok: true, data };
}

export async function updatePattern(
  patternId: string,
  input: {
    title?: string;
    summary?: string;
    confidence?: PatternConfidence;
    metadata?: Record<string, unknown>;
    actorId: string;
    correlationId?: string | null;
    causationId?: string | null;
  },
): Promise<PatternResult<PatternRecord>> {
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  const current = await getPattern(patternId);
  if (!current.ok) return current;
  if (current.data.status === "validated") return failed("Validated patterns are immutable. Deprecate and recreate to change.", "governance_violation");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) { if (!required(input.title)) return validation("title cannot be empty."); patch.title = input.title.trim(); }
  if (input.summary !== undefined) { if (!required(input.summary)) return validation("summary cannot be empty."); patch.summary = input.summary.trim(); }
  if (input.confidence !== undefined) { if (!confidenceValues.includes(input.confidence)) return validation(`confidence must be one of: ${confidenceValues.join(", ")}.`); patch.confidence = input.confidence; }
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_patterns")
    .update(patch)
    .eq("id", patternId)
    .select(patternColumns)
    .single<PatternRecord>();
  if (error || !data) return failed("Unable to update pattern.");
  return emitPatternEvent(data, "PATTERN_UPDATED", input.actorId, input.correlationId, input.causationId);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export async function validatePattern(
  patternId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PatternResult<PatternRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getPattern(patternId);
  if (!current.ok) return current;
  if (current.data.status !== "candidate") return failed(`Only candidate patterns can be validated; current status is '${current.data.status}'.`, "governance_violation");
  if (current.data.observation_count < PATTERN_VALIDATION_THRESHOLD) {
    return failed(
      `Pattern requires at least ${PATTERN_VALIDATION_THRESHOLD} observations to be validated; currently has ${current.data.observation_count}.`,
      "governance_violation",
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_patterns")
    .update({ status: "validated", updated_at: new Date().toISOString() })
    .eq("id", patternId)
    .select(patternColumns)
    .single<PatternRecord>();
  if (error || !data) return failed("Unable to validate pattern.");
  return emitPatternEvent(data, "PATTERN_VALIDATED", actorId, correlationId, causationId, { threshold: PATTERN_VALIDATION_THRESHOLD });
}

// ─── Lifecycle: archive / deprecate ──────────────────────────────────────────

async function setPatternStatus(
  patternId: string,
  status: "archived" | "deprecated",
  eventType: PatternEventType,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PatternResult<PatternRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getPattern(patternId);
  if (!current.ok) return current;
  if (current.data.status === "validated" && status !== "deprecated") {
    return failed("Validated patterns can only be deprecated, not directly archived.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_patterns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", patternId)
    .select(patternColumns)
    .single<PatternRecord>();
  if (error || !data) return failed(`Unable to ${status} pattern.`);
  return emitPatternEvent(data, eventType, actorId, correlationId, causationId);
}

export const archivePattern = (patternId: string, actorId: string, correlationId?: string | null, causationId?: string | null) =>
  setPatternStatus(patternId, "archived", "PATTERN_ARCHIVED", actorId, correlationId, causationId);

export const deprecatePattern = (patternId: string, actorId: string, correlationId?: string | null, causationId?: string | null) =>
  setPatternStatus(patternId, "deprecated", "PATTERN_DEPRECATED", actorId, correlationId, causationId);

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePattern(
  patternId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PatternResult<{ id: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getPattern(patternId);
  if (!current.ok) return current as PatternResult<{ id: string }>;
  if (current.data.status === "validated") return failed("Validated patterns cannot be deleted; deprecate them first.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organizational_patterns").delete().eq("id", patternId);
  if (error) return failed("Unable to delete pattern.");

  const emitted = await emitPatternEvent(current.data, "PATTERN_DELETED", actorId, correlationId, causationId);
  if (!emitted.ok) return emitted as PatternResult<{ id: string }>;
  return { ok: true, data: { id: patternId } };
}

// ─── Observations ─────────────────────────────────────────────────────────────

export async function recordObservation(input: {
  patternId: string;
  sourceType: PatternSourceType;
  sourceId: string;
  observationSummary: string;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PatternResult<PatternObservation>> {
  if (!validUuid(input.patternId)) return validation("patternId must be a UUID.");
  if (!sourceTypes.includes(input.sourceType)) return validation(`sourceType must be one of: ${sourceTypes.join(", ")}.`);
  if (!validUuid(input.sourceId)) return validation("sourceId must be a UUID.");
  if (!required(input.observationSummary)) return validation("observationSummary is required.");

  const current = await getPattern(input.patternId);
  if (!current.ok) return current as PatternResult<PatternObservation>;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_pattern_observations")
    .insert({
      pattern_id: input.patternId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      observation_summary: input.observationSummary.trim(),
    })
    .select(observationColumns)
    .single<PatternObservation>();
  if (error || !data) return failed("Unable to record observation.");

  const refreshed = await getPattern(input.patternId);
  if (refreshed.ok) {
    await emitPatternEvent(refreshed.data, "PATTERN_OBSERVATION_RECORDED", input.actorId, input.correlationId, input.causationId, {
      observationId: data.id,
      observationSourceType: data.source_type,
    });
  }

  return { ok: true, data };
}

// ─── Explanation & export ─────────────────────────────────────────────────────

async function getObservations(patternId: string): Promise<PatternResult<PatternObservation[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_pattern_observations")
    .select(observationColumns)
    .eq("pattern_id", patternId)
    .order("recorded_at", { ascending: true })
    .returns<PatternObservation[]>();
  if (error || !data) return failed("Unable to load pattern observations.");
  return { ok: true, data };
}

async function getSources(patternId: string): Promise<PatternResult<PatternSource[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizational_pattern_sources")
    .select(sourceColumns)
    .eq("pattern_id", patternId)
    .order("created_at", { ascending: true })
    .returns<PatternSource[]>();
  if (error || !data) return failed("Unable to load pattern sources.");
  return { ok: true, data };
}

async function resolveEvidenceByType(
  sources: PatternSource[],
): Promise<{ memories: PatternEvidence[]; events: PatternEvidence[]; decisions: PatternEvidence[]; outcomes: PatternEvidence[] }> {
  const supabase = await createSupabaseServerClient();
  const byType = (type: string) => sources.filter((s) => s.source_type === type).map((s) => s.source_id);

  const memoryIds = byType("organizational_memory");
  const eventIds = byType("platform_event");
  const decisionIds = byType("decision");
  const outcomeIds = byType("outcome");

  const [memRes, evtRes, decRes, outRes] = await Promise.all([
    memoryIds.length ? supabase.from("organizational_memory").select("id,title,summary,memory_category,status,confidence").in("id", memoryIds).returns<PatternEvidence[]>() : Promise.resolve({ data: [] }),
    eventIds.length ? supabase.from("platform_events").select("id,event_type,event_category,occurred_at,workspace_id").in("id", eventIds).returns<PatternEvidence[]>() : Promise.resolve({ data: [] }),
    decisionIds.length ? supabase.from("project_decisions").select("id,decision_type,decision_status").in("id", decisionIds).returns<PatternEvidence[]>() : Promise.resolve({ data: [] }),
    outcomeIds.length ? supabase.from("decision_outcomes").select("id,outcome_type,success_status").in("id", outcomeIds).returns<PatternEvidence[]>() : Promise.resolve({ data: [] }),
  ]);

  return {
    memories: (memRes.data ?? []) as PatternEvidence[],
    events: (evtRes.data ?? []) as PatternEvidence[],
    decisions: (decRes.data ?? []) as PatternEvidence[],
    outcomes: (outRes.data ?? []) as PatternEvidence[],
  };
}

export async function explainPattern(patternId: string): Promise<PatternResult<PatternExplanation>> {
  const pattern = await getPattern(patternId);
  if (!pattern.ok) return pattern as PatternResult<PatternExplanation>;

  const observations = await getObservations(patternId);
  if (!observations.ok) return observations as PatternResult<PatternExplanation>;

  const sources = await getSources(patternId);
  if (!sources.ok) return sources as PatternResult<PatternExplanation>;

  const resolved = await resolveEvidenceByType(sources.data);

  return {
    ok: true,
    data: {
      pattern: pattern.data,
      observations: observations.data,
      supportingMemories: resolved.memories,
      supportingEvents: resolved.events as never,
      supportingDecisions: resolved.decisions,
      supportingOutcomes: resolved.outcomes,
    },
  };
}

export async function exportPattern(patternId: string): Promise<PatternResult<PatternExport>> {
  const explanation = await explainPattern(patternId);
  if (!explanation.ok) return explanation as PatternResult<PatternExport>;

  const sources = await getSources(patternId);
  if (!sources.ok) return sources as PatternResult<PatternExport>;

  return {
    ok: true,
    data: {
      pattern: explanation.data.pattern,
      observations: explanation.data.observations,
      sources: sources.data,
      memories: explanation.data.supportingMemories,
      events: explanation.data.supportingEvents,
      decisions: explanation.data.supportingDecisions,
      outcomes: explanation.data.supportingOutcomes,
      lineage: sources.data,
    },
  };
}

// ─── Health ────────────────────────────────────────────────────────────────────

export function computePatternHealthSnapshot(patterns: PatternRecord[], sources: PatternSource[]): PatternHealth {
  const total = patterns.length;
  const sourcePatternIds = new Set(sources.map((s) => s.pattern_id));
  const totalObservations = patterns.reduce((sum, p) => sum + p.observation_count, 0);

  return {
    candidateCount: patterns.filter((p) => p.status === "candidate").length,
    validatedCount: patterns.filter((p) => p.status === "validated").length,
    deprecatedCount: patterns.filter((p) => p.status === "deprecated").length,
    archivedCount: patterns.filter((p) => p.status === "archived").length,
    averageObservationCount: total ? totalObservations / total : 0,
    lineageCoverage: total ? Math.min(1, Math.max(0, sourcePatternIds.size / total)) : 0,
  };
}

export async function getPatternHealth(workspaceId: string): Promise<PatternResult<PatternHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const patterns = await listPatterns(workspaceId);
  if (!patterns.ok) return patterns as PatternResult<PatternHealth>;

  const supabase = await createSupabaseServerClient();
  const ids = patterns.data.map((p) => p.id);
  const { data: sources } = ids.length
    ? await supabase.from("organizational_pattern_sources").select(sourceColumns).in("pattern_id", ids).returns<PatternSource[]>()
    : { data: [] as PatternSource[] };

  return { ok: true, data: computePatternHealthSnapshot(patterns.data, sources ?? []) };
}
