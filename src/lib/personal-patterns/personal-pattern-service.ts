import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePersonalPatternSources } from "./source-resolver";
import type {
  PersonalPatternCategory,
  PersonalPatternConfidence,
  PersonalPatternEventType,
  PersonalPatternEvidence,
  PersonalPatternExplanation,
  PersonalPatternExport,
  PersonalPatternHealth,
  PersonalPatternLineage,
  PersonalPatternObservation,
  PersonalPatternRecord,
  PersonalPatternResult,
  PersonalPatternSource,
  PersonalPatternSourceRelationship,
  PersonalPatternSourceType,
  PersonalPatternStatus,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: PersonalPatternCategory[] = [
  "decision_pattern",
  "risk_response_pattern",
  "stakeholder_management_pattern",
  "communication_pattern",
  "execution_pattern",
  "planning_pattern",
  "escalation_pattern",
  "governance_pattern",
  "delivery_pattern",
  "approval_pattern",
  "follow_up_pattern",
  "dependency_resolution_pattern",
  "other",
];

const CONFIDENCE_VALUES: PersonalPatternConfidence[] = ["low", "medium", "high", "very_high"];

const SOURCE_TYPES: PersonalPatternSourceType[] = [
  "platform_event",
  "decision",
  "decision_effectiveness",
  "organizational_pattern",
  "organizational_memory",
  "personal_memory",
  "outcome",
  "risk",
  "task",
  "milestone",
  "stakeholder",
];

const SOURCE_RELATIONSHIPS: PersonalPatternSourceRelationship[] = [
  "supports",
  "contradicts",
  "caused_by",
  "derived_from",
  "reviewed_during",
  "supersedes",
  "related_to",
];

const PATTERN_COLUMNS =
  "id,workspace_id,pm_user_id,pattern_category,title,summary,confidence,status,created_at,updated_at,created_by,metadata";
const SOURCE_COLUMNS = "id,pattern_id,source_type,source_id,relationship_type,created_at";
const OBSERVATION_COLUMNS = "id,pattern_id,observation_summary,recorded_at,recorded_by,metadata";

// ─── Validation helpers ───────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
  );
}

function required(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validation<T>(error: string): PersonalPatternResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(error: string, failureClass = "persistence_failed"): PersonalPatternResult<T> {
  return { ok: false, error, failureClass };
}

function validateSources(
  sources: Array<{
    sourceType: PersonalPatternSourceType;
    sourceId: string;
    relationshipType: PersonalPatternSourceRelationship;
  }>,
): PersonalPatternResult<true> {
  if (!sources.length)
    return validation("At least one source is required; every personal pattern must point to evidence.");
  for (const s of sources) {
    if (!SOURCE_TYPES.includes(s.sourceType))
      return validation(`sourceType must be one of: ${SOURCE_TYPES.join(", ")}.`);
    if (!validUuid(s.sourceId)) return validation("sourceId must be a UUID.");
    if (!SOURCE_RELATIONSHIPS.includes(s.relationshipType))
      return validation(`relationshipType must be one of: ${SOURCE_RELATIONSHIPS.join(", ")}.`);
  }
  return { ok: true, data: true };
}

// ─── Audit event emission ─────────────────────────────────────────────────────

async function emitPatternEvent(
  pattern: PersonalPatternRecord,
  eventType: PersonalPatternEventType,
  actorId: string | null | undefined,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalPatternResult<PersonalPatternRecord>> {
  const actor = actorId ?? pattern.created_by;
  const event = await createPlatformEvent({
    workspaceId: pattern.workspace_id,
    actorId: actor,
    actorType: actor ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actor ? "user_action" : "system",
    correlationId: correlationId ?? pattern.id,
    causationId: causationId ?? null,
    rawReferenceTable: "personal_pm_patterns",
    rawReferenceId: pattern.id,
    learningEligible: false,
    visibility: "personal",
    sensitivityLevel: "confidential",
    eventPayload: {
      patternId: pattern.id,
      patternCategory: pattern.pattern_category,
      status: pattern.status,
      pmUserId: pattern.pm_user_id,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: pattern };
}

async function emitObservationEvent(
  pattern: PersonalPatternRecord,
  observationId: string,
  actorId: string | null | undefined,
  correlationId?: string | null,
): Promise<PersonalPatternResult<PersonalPatternObservation>> {
  const actor = actorId ?? pattern.created_by;
  const event = await createPlatformEvent({
    workspaceId: pattern.workspace_id,
    actorId: actor,
    actorType: actor ? "user" : "system",
    eventType: "PERSONAL_PATTERN_OBSERVATION_RECORDED",
    eventCategory: "governance",
    source: actor ? "user_action" : "system",
    correlationId: correlationId ?? pattern.id,
    causationId: null,
    rawReferenceTable: "personal_pm_pattern_observations",
    rawReferenceId: observationId,
    learningEligible: false,
    visibility: "personal",
    sensitivityLevel: "confidential",
    eventPayload: {
      patternId: pattern.id,
      observationId,
      pmUserId: pattern.pm_user_id,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: { id: observationId } as PersonalPatternObservation };
}

// ─── Privacy boundary enforcement ────────────────────────────────────────────

async function assertOwnership(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalPatternResult<PersonalPatternRecord>> {
  if (!validUuid(patternId)) return validation("patternId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_patterns")
    .select(PATTERN_COLUMNS)
    .eq("id", patternId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .single<PersonalPatternRecord>();
  if (error || !data) return failed("Personal pattern not found or access denied.", "not_found");
  return { ok: true, data };
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

async function getSources(patternId: string): Promise<PersonalPatternResult<PersonalPatternSource[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_pattern_sources")
    .select(SOURCE_COLUMNS)
    .eq("pattern_id", patternId)
    .order("created_at", { ascending: true })
    .returns<PersonalPatternSource[]>();
  if (error || !data) return failed("Unable to load pattern sources.");
  return { ok: true, data };
}

async function getObservations(patternId: string): Promise<PersonalPatternResult<PersonalPatternObservation[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_pattern_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("pattern_id", patternId)
    .order("recorded_at", { ascending: true })
    .returns<PersonalPatternObservation[]>();
  if (error || !data) return failed("Unable to load pattern observations.");
  return { ok: true, data };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createPersonalPattern(input: {
  workspaceId: string;
  pmUserId: string;
  patternCategory: PersonalPatternCategory;
  title: string;
  summary: string;
  confidence: PersonalPatternConfidence;
  createdBy: string;
  metadata?: Record<string, unknown>;
  sources: Array<{
    sourceType: PersonalPatternSourceType;
    sourceId: string;
    relationshipType: PersonalPatternSourceRelationship;
  }>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PersonalPatternResult<PersonalPatternRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.pmUserId)) return validation("pmUserId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!CATEGORIES.includes(input.patternCategory))
    return validation(`patternCategory must be one of: ${CATEGORIES.join(", ")}.`);
  if (!CONFIDENCE_VALUES.includes(input.confidence))
    return validation(`confidence must be one of: ${CONFIDENCE_VALUES.join(", ")}.`);
  if (!required(input.title)) return validation("title is required.");
  if (!required(input.summary)) return validation("summary is required.");
  const sourceValidation = validateSources(input.sources);
  if (!sourceValidation.ok) return sourceValidation;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_patterns")
    .insert({
      workspace_id: input.workspaceId,
      pm_user_id: input.pmUserId,
      pattern_category: input.patternCategory,
      title: input.title.trim(),
      summary: input.summary.trim(),
      confidence: input.confidence,
      status: "active" as PersonalPatternStatus,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(PATTERN_COLUMNS)
    .single<PersonalPatternRecord>();
  if (error || !data) return failed("Unable to create personal pattern.");

  const { error: sourceError } = await supabase.from("personal_pm_pattern_sources").insert(
    input.sources.map((s) => ({
      pattern_id: data.id,
      source_type: s.sourceType,
      source_id: s.sourceId,
      relationship_type: s.relationshipType,
    })),
  );
  if (sourceError) return failed("Unable to attach pattern sources.");

  return emitPatternEvent(data, "PERSONAL_PATTERN_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function getPersonalPattern(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalPatternResult<PersonalPatternRecord>> {
  return assertOwnership(patternId, workspaceId, pmUserId);
}

export async function listPersonalPatterns(
  workspaceId: string,
  pmUserId: string,
  filter?: { status?: PersonalPatternStatus; category?: PersonalPatternCategory },
): Promise<PersonalPatternResult<PersonalPatternRecord[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("personal_pm_patterns")
    .select(PATTERN_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .order("updated_at", { ascending: false });
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.category) query = query.eq("pattern_category", filter.category);
  const { data, error } = await query.returns<PersonalPatternRecord[]>();
  if (error || !data) return failed("Unable to list personal patterns.");
  return { ok: true, data };
}

export async function updatePersonalPattern(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  input: {
    title?: string;
    summary?: string;
    confidence?: PersonalPatternConfidence;
    metadata?: Record<string, unknown>;
    actorId: string;
    correlationId?: string | null;
    causationId?: string | null;
  },
): Promise<PersonalPatternResult<PersonalPatternRecord>> {
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  const current = await assertOwnership(patternId, workspaceId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "frozen")
    return failed("Frozen patterns cannot be edited; archive them instead.", "governance_violation");

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
    if (!CONFIDENCE_VALUES.includes(input.confidence))
      return validation(`confidence must be one of: ${CONFIDENCE_VALUES.join(", ")}.`);
    patch.confidence = input.confidence;
  }
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_patterns")
    .update(patch)
    .eq("id", patternId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .select(PATTERN_COLUMNS)
    .single<PersonalPatternRecord>();
  if (error || !data) return failed("Unable to update personal pattern.");
  return emitPatternEvent(data, "PERSONAL_PATTERN_UPDATED", input.actorId, input.correlationId, input.causationId);
}

async function setStatus(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  nextStatus: "archived" | "frozen" | "deprecated",
  eventType: PersonalPatternEventType,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalPatternResult<PersonalPatternRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await assertOwnership(patternId, workspaceId, pmUserId);
  if (!current.ok) return current;
  if (current.data.status === "frozen" && nextStatus !== "archived") {
    return failed("Frozen patterns can only be archived.", "governance_violation");
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_patterns")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", patternId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .select(PATTERN_COLUMNS)
    .single<PersonalPatternRecord>();
  if (error || !data) return failed(`Unable to ${nextStatus} personal pattern.`);
  return emitPatternEvent(data, eventType, actorId, correlationId, causationId);
}

export const archivePersonalPattern = (
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
) => setStatus(patternId, workspaceId, pmUserId, "archived", "PERSONAL_PATTERN_ARCHIVED", actorId, correlationId, causationId);

export const freezePersonalPattern = (
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
) => setStatus(patternId, workspaceId, pmUserId, "frozen", "PERSONAL_PATTERN_FROZEN", actorId, correlationId, causationId);

export const deprecatePersonalPattern = (
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
) => setStatus(patternId, workspaceId, pmUserId, "deprecated", "PERSONAL_PATTERN_DEPRECATED", actorId, correlationId, causationId);

export async function deletePersonalPattern(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalPatternResult<{ id: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await assertOwnership(patternId, workspaceId, pmUserId);
  if (!current.ok) return current as PersonalPatternResult<{ id: string }>;
  if (current.data.status === "frozen")
    return failed("Frozen patterns cannot be deleted; archive them instead.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personal_pm_patterns")
    .delete()
    .eq("id", patternId)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId);
  if (error) return failed("Unable to delete personal pattern.");

  const emitted = await emitPatternEvent(current.data, "PERSONAL_PATTERN_DELETED", actorId, correlationId, causationId);
  if (!emitted.ok) return emitted as PersonalPatternResult<{ id: string }>;
  return { ok: true, data: { id: patternId } };
}

export async function recordPersonalPatternObservation(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
  input: {
    observationSummary: string;
    recordedBy: string;
    metadata?: Record<string, unknown>;
    correlationId?: string | null;
  },
): Promise<PersonalPatternResult<PersonalPatternObservation>> {
  if (!validUuid(input.recordedBy)) return validation("recordedBy must be a UUID.");
  if (!required(input.observationSummary)) return validation("observationSummary is required.");

  const pattern = await assertOwnership(patternId, workspaceId, pmUserId);
  if (!pattern.ok) return pattern as PersonalPatternResult<PersonalPatternObservation>;
  if (pattern.data.status === "frozen")
    return failed("Observations cannot be added to frozen patterns.", "governance_violation");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_pattern_observations")
    .insert({
      pattern_id: patternId,
      observation_summary: input.observationSummary.trim(),
      recorded_by: input.recordedBy,
      metadata: input.metadata ?? {},
    })
    .select(OBSERVATION_COLUMNS)
    .single<PersonalPatternObservation>();
  if (error || !data) return failed("Unable to record observation.");

  const emitted = await emitObservationEvent(pattern.data, data.id, input.recordedBy, input.correlationId);
  if (!emitted.ok) return emitted;
  return { ok: true, data };
}

export async function explainPersonalPattern(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalPatternResult<PersonalPatternExplanation>> {
  const pattern = await assertOwnership(patternId, workspaceId, pmUserId);
  if (!pattern.ok) return pattern as PersonalPatternResult<PersonalPatternExplanation>;

  const [observations, sources] = await Promise.all([
    getObservations(patternId),
    getSources(patternId),
  ]);
  if (!observations.ok) return observations as PersonalPatternResult<PersonalPatternExplanation>;
  if (!sources.ok) return sources as PersonalPatternResult<PersonalPatternExplanation>;

  const resolved = await resolvePersonalPatternSources(pattern.data, sources.data);

  return {
    ok: true,
    data: {
      pattern: pattern.data,
      observations: observations.data,
      sources: sources.data,
      supportingEvents: resolved.platformEvents as never,
      supportingDecisions: resolved.decisions,
      supportingDecisionEffectiveness: resolved.decisionEffectiveness,
      supportingOrganizationalPatterns: resolved.organizationalPatterns,
      supportingOrganizationalMemory: resolved.organizationalMemory,
      supportingPersonalMemory: resolved.personalMemory,
      supportingOutcomes: resolved.outcomes,
      unresolvedSources: resolved.unresolvedSources,
    },
  };
}

export async function buildPersonalPatternLineage(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalPatternResult<PersonalPatternLineage>> {
  const explanation = await explainPersonalPattern(patternId, workspaceId, pmUserId);
  if (!explanation.ok) return explanation as PersonalPatternResult<PersonalPatternLineage>;

  const {
    pattern,
    observations,
    sources,
    supportingEvents,
    supportingDecisions,
    supportingDecisionEffectiveness,
    supportingOrganizationalPatterns,
    supportingOrganizationalMemory,
    supportingPersonalMemory,
    supportingOutcomes,
    unresolvedSources,
  } = explanation.data;

  type Timestamped = { occurred_at?: string; created_at?: string; recorded_at?: string };
  const allItems = [
    ...(supportingEvents as unknown as Timestamped[]),
    ...(supportingDecisions as Timestamped[]),
    ...(supportingDecisionEffectiveness as Timestamped[]),
    ...(supportingOrganizationalPatterns as Timestamped[]),
    ...(supportingOrganizationalMemory as Timestamped[]),
    ...(supportingPersonalMemory as Timestamped[]),
    ...(supportingOutcomes as Timestamped[]),
  ] as Timestamped[];
  const timestamps = allItems
    .map((i) => i.occurred_at ?? i.created_at ?? i.recorded_at)
    .filter((t): t is string => Boolean(t))
    .sort();
  const timeline =
    timestamps.length >= 2
      ? `${timestamps[0]} → ${timestamps[timestamps.length - 1]}`
      : timestamps[0] ?? pattern.created_at;

  return {
    ok: true,
    data: {
      pattern,
      observations,
      sources,
      events: supportingEvents,
      decisions: supportingDecisions,
      decisionEffectiveness: supportingDecisionEffectiveness,
      organizationalPatterns: supportingOrganizationalPatterns,
      organizationalMemory: supportingOrganizationalMemory,
      personalMemory: supportingPersonalMemory,
      outcomes: supportingOutcomes,
      unresolvedSources,
      timeline,
    },
  };
}

export async function exportPersonalPattern(
  patternId: string,
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalPatternResult<PersonalPatternExport>> {
  const lineageResult = await buildPersonalPatternLineage(patternId, workspaceId, pmUserId);
  if (!lineageResult.ok) return lineageResult as PersonalPatternResult<PersonalPatternExport>;

  const sources = await getSources(patternId);
  if (!sources.ok) return sources as PersonalPatternResult<PersonalPatternExport>;
  const observations = await getObservations(patternId);
  if (!observations.ok) return observations as PersonalPatternResult<PersonalPatternExport>;

  return {
    ok: true,
    data: {
      pattern: lineageResult.data.pattern,
      observations: observations.data,
      sources: sources.data,
      lineage: lineageResult.data,
      unresolvedSources: lineageResult.data.unresolvedSources,
      exportedAt: new Date().toISOString(),
    },
  };
}

export async function getPersonalPatternHealth(
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalPatternResult<PersonalPatternHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const patterns = await listPersonalPatterns(workspaceId, pmUserId);
  if (!patterns.ok) return patterns as PersonalPatternResult<PersonalPatternHealth>;

  const supabase = await createSupabaseServerClient();
  const ids = patterns.data.map((p) => p.id);

  const [sourcesResult, observationsResult] = await Promise.all([
    ids.length
      ? supabase
          .from("personal_pm_pattern_sources")
          .select(SOURCE_COLUMNS)
          .in("pattern_id", ids)
          .returns<PersonalPatternSource[]>()
      : Promise.resolve({ data: [] as PersonalPatternSource[] }),
    ids.length
      ? supabase
          .from("personal_pm_pattern_observations")
          .select(OBSERVATION_COLUMNS)
          .in("pattern_id", ids)
          .returns<PersonalPatternEvidence[]>()
      : Promise.resolve({ data: [] as PersonalPatternEvidence[] }),
  ]);

  const sources = sourcesResult.data ?? [];
  const observations = observationsResult.data ?? [];

  const total = patterns.data.length;
  const divisor = total || 1;
  const sourcePatternIds = new Set(sources.map((s: PersonalPatternSource) => s.pattern_id));
  const validLineageIds = new Set(
    sources
      .filter((s: PersonalPatternSource) => Boolean(s.source_type && s.source_id && s.relationship_type))
      .map((s: PersonalPatternSource) => s.pattern_id),
  );

  return {
    ok: true,
    data: {
      activeCount: patterns.data.filter((p) => p.status === "active").length,
      archivedCount: patterns.data.filter((p) => p.status === "archived").length,
      frozenCount: patterns.data.filter((p) => p.status === "frozen").length,
      deprecatedCount: patterns.data.filter((p) => p.status === "deprecated").length,
      observationCount: observations.length,
      sourceCoverage: Math.min(1, Math.max(0, sourcePatternIds.size / divisor)),
      lineageCoverage: Math.min(1, Math.max(0, validLineageIds.size / divisor)),
    },
  };
}
