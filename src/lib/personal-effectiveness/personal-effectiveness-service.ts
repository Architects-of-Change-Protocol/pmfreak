import { createPlatformEvent, getPlatformEvents } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePersonalEffectivenessSources } from "./source-resolver";
import type {
  PersonalEffectivenessEventType,
  PersonalEffectivenessExplanation,
  PersonalEffectivenessExport,
  PersonalEffectivenessHealth,
  PersonalEffectivenessLineage,
  PersonalEffectivenessObservation,
  PersonalEffectivenessOutcomeClassification,
  PersonalEffectivenessRecord,
  PersonalEffectivenessResult,
  PersonalEffectivenessSource,
  PersonalEffectivenessSourceType,
  PersonalEffectivenessRelationshipType,
  PersonalEffectivenessStatus,
} from "./types";

const OUTCOME_CLASSIFICATIONS: PersonalEffectivenessOutcomeClassification[] = [
  "success",
  "partial_success",
  "failure",
  "unknown",
];
const STATUSES: PersonalEffectivenessStatus[] = [
  "candidate",
  "validated",
  "archived",
  "deprecated",
];
const SOURCE_TYPES: PersonalEffectivenessSourceType[] = [
  "platform_event",
  "decision",
  "decision_effectiveness",
  "organizational_pattern",
  "organizational_memory",
  "personal_memory",
  "personal_pattern",
  "outcome",
  "risk",
  "task",
  "milestone",
  "stakeholder",
];
const RELATIONSHIP_TYPES: PersonalEffectivenessRelationshipType[] = [
  "supports",
  "contradicts",
  "caused_by",
  "derived_from",
  "reviewed_during",
  "supersedes",
  "related_to",
];

const RECORD_COLUMNS =
  "id,workspace_id,pm_user_id,personal_pattern_id,personal_memory_id,decision_id,decision_effectiveness_id,outcome_classification,effectiveness_status,summary,created_at,updated_at,created_by,metadata";
const SOURCE_COLUMNS =
  "id,effectiveness_id,source_type,source_id,relationship_type,created_at";
const OBSERVATION_COLUMNS =
  "id,effectiveness_id,observation_summary,recorded_at,recorded_by,metadata";

function validUuid(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}
function required(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function validation<T>(error: string): PersonalEffectivenessResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}
function failed<T>(
  error: string,
  failureClass = "persistence_failed",
): PersonalEffectivenessResult<T> {
  return { ok: false, error, failureClass };
}
function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

async function emitEvent(
  record: PersonalEffectivenessRecord,
  eventType: PersonalEffectivenessEventType,
  actorId: string | null | undefined,
  correlationId?: string | null,
  causationId?: string | null,
  extra: Record<string, unknown> = {},
): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  const actor = actorId ?? record.created_by;
  const event = await createPlatformEvent({
    workspaceId: record.workspace_id,
    actorId: actor,
    actorType: actor ? "user" : "system",
    eventType,
    eventCategory: "governance",
    source: actor ? "user_action" : "system",
    visibility: "personal",
    sensitivityLevel: "confidential",
    correlationId: correlationId ?? record.id,
    causationId: causationId ?? null,
    rawReferenceTable: "personal_pm_effectiveness",
    rawReferenceId: record.id,
    learningEligible: false,
    eventPayload: {
      effectivenessId: record.id,
      pmUserId: record.pm_user_id,
      effectivenessStatus: record.effectiveness_status,
      outcomeClassification: record.outcome_classification,
      ...extra,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: record };
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createPersonalEffectiveness(input: {
  workspaceId: string;
  pmUserId: string;
  actorId: string;
  outcomeClassification: PersonalEffectivenessOutcomeClassification;
  summary: string;
  personalPatternId?: string | null;
  personalMemoryId?: string | null;
  decisionId?: string | null;
  decisionEffectivenessId?: string | null;
  sources: Array<{
    sourceType: PersonalEffectivenessSourceType;
    sourceId: string;
    relationshipType: PersonalEffectivenessRelationshipType;
  }>;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.pmUserId)) return validation("pmUserId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!OUTCOME_CLASSIFICATIONS.includes(input.outcomeClassification)) {
    return validation(`outcomeClassification must be one of: ${OUTCOME_CLASSIFICATIONS.join(", ")}.`);
  }
  if (!required(input.summary)) return validation("summary is required.");

  const hasAnchor =
    validUuid(input.personalPatternId) ||
    validUuid(input.personalMemoryId) ||
    validUuid(input.decisionId) ||
    validUuid(input.decisionEffectivenessId);
  if (!hasAnchor) {
    return validation(
      "At least one of personalPatternId, personalMemoryId, decisionId, or decisionEffectivenessId must be provided.",
    );
  }

  if (!input.sources || input.sources.length === 0) {
    return validation("At least one source is required.");
  }
  for (const s of input.sources) {
    if (!SOURCE_TYPES.includes(s.sourceType)) {
      return validation(`sourceType must be one of: ${SOURCE_TYPES.join(", ")}.`);
    }
    if (!validUuid(s.sourceId)) return validation("sourceId must be a UUID.");
    if (!RELATIONSHIP_TYPES.includes(s.relationshipType)) {
      return validation(`relationshipType must be one of: ${RELATIONSHIP_TYPES.join(", ")}.`);
    }
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("personal_pm_effectiveness")
    .insert({
      workspace_id: input.workspaceId,
      pm_user_id: input.pmUserId,
      personal_pattern_id: input.personalPatternId ?? null,
      personal_memory_id: input.personalMemoryId ?? null,
      decision_id: input.decisionId ?? null,
      decision_effectiveness_id: input.decisionEffectivenessId ?? null,
      outcome_classification: input.outcomeClassification,
      effectiveness_status: "candidate",
      summary: input.summary.trim(),
      created_by: input.actorId,
      metadata: input.metadata ?? {},
    })
    .select(RECORD_COLUMNS)
    .single<PersonalEffectivenessRecord>();
  if (error || !data) return failed("Unable to create personal effectiveness record.");

  // Insert sources.
  const sourceRows = input.sources.map((s) => ({
    effectiveness_id: data.id,
    source_type: s.sourceType,
    source_id: s.sourceId,
    relationship_type: s.relationshipType,
  }));
  const { error: srcError } = await supabase
    .from("personal_pm_effectiveness_sources")
    .insert(sourceRows);
  if (srcError) return failed("Unable to attach sources to effectiveness record.");

  return emitEvent(data, "PERSONAL_EFFECTIVENESS_CREATED", input.actorId, input.correlationId, input.causationId);
}

// ─── Get ───────────────────────────────────────────────────────────────────────

export async function getPersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  if (!validUuid(effectivenessId)) return validation("effectivenessId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_effectiveness")
    .select(RECORD_COLUMNS)
    .eq("id", effectivenessId)
    .eq("pm_user_id", pmUserId)
    .single<PersonalEffectivenessRecord>();
  if (error || !data) return failed("Personal effectiveness record not found.", "not_found");
  return { ok: true, data };
}

// ─── List ──────────────────────────────────────────────────────────────────────

export async function listPersonalEffectiveness(
  workspaceId: string,
  pmUserId: string,
  filters?: { status?: PersonalEffectivenessStatus; outcomeClassification?: PersonalEffectivenessOutcomeClassification },
): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("personal_pm_effectiveness")
    .select(RECORD_COLUMNS)
    .eq("workspace_id", workspaceId)
    .eq("pm_user_id", pmUserId)
    .order("updated_at", { ascending: false });

  if (filters?.status) query = query.eq("effectiveness_status", filters.status);
  if (filters?.outcomeClassification) query = query.eq("outcome_classification", filters.outcomeClassification);

  const { data, error } = await query.returns<PersonalEffectivenessRecord[]>();
  if (error || !data) return failed("Unable to list personal effectiveness records.");
  return { ok: true, data };
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updatePersonalEffectiveness(input: {
  effectivenessId: string;
  pmUserId: string;
  actorId: string;
  summary?: string;
  outcomeClassification?: PersonalEffectivenessOutcomeClassification;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  if (!validUuid(input.effectivenessId)) return validation("effectivenessId must be a UUID.");
  if (!validUuid(input.pmUserId)) return validation("pmUserId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const current = await getPersonalEffectiveness(input.effectivenessId, input.pmUserId);
  if (!current.ok) return current;

  if (current.data.effectiveness_status === "validated") {
    return failed("Validated personal effectiveness records cannot be updated.", "governance_violation");
  }
  if (current.data.effectiveness_status === "archived") {
    return failed("Archived personal effectiveness records cannot be updated.", "governance_violation");
  }

  if (input.outcomeClassification && !OUTCOME_CLASSIFICATIONS.includes(input.outcomeClassification)) {
    return validation(`outcomeClassification must be one of: ${OUTCOME_CLASSIFICATIONS.join(", ")}.`);
  }
  if (input.summary !== undefined && !required(input.summary)) {
    return validation("summary cannot be empty.");
  }

  const patch: Record<string, unknown> = {};
  if (input.summary !== undefined) patch.summary = input.summary.trim();
  if (input.outcomeClassification !== undefined) patch.outcome_classification = input.outcomeClassification;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_effectiveness")
    .update(patch)
    .eq("id", input.effectivenessId)
    .eq("pm_user_id", input.pmUserId)
    .select(RECORD_COLUMNS)
    .single<PersonalEffectivenessRecord>();
  if (error || !data) return failed("Unable to update personal effectiveness record.");

  return emitEvent(data, "PERSONAL_EFFECTIVENESS_UPDATED", input.actorId, input.correlationId, input.causationId);
}

// ─── Validate ──────────────────────────────────────────────────────────────────

export async function validatePersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const current = await getPersonalEffectiveness(effectivenessId, pmUserId);
  if (!current.ok) return current;

  if (current.data.effectiveness_status !== "candidate") {
    return failed("Only candidate records can be validated.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_effectiveness")
    .update({ effectiveness_status: "validated" })
    .eq("id", effectivenessId)
    .eq("pm_user_id", pmUserId)
    .select(RECORD_COLUMNS)
    .single<PersonalEffectivenessRecord>();
  if (error || !data) return failed("Unable to validate personal effectiveness record.");

  return emitEvent(data, "PERSONAL_EFFECTIVENESS_VALIDATED", actorId, correlationId, causationId);
}

// ─── Archive ───────────────────────────────────────────────────────────────────

export async function archivePersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const current = await getPersonalEffectiveness(effectivenessId, pmUserId);
  if (!current.ok) return current;

  if (current.data.effectiveness_status === "archived") {
    return failed("Record is already archived.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_effectiveness")
    .update({ effectiveness_status: "archived" })
    .eq("id", effectivenessId)
    .eq("pm_user_id", pmUserId)
    .select(RECORD_COLUMNS)
    .single<PersonalEffectivenessRecord>();
  if (error || !data) return failed("Unable to archive personal effectiveness record.");

  return emitEvent(data, "PERSONAL_EFFECTIVENESS_ARCHIVED", actorId, correlationId, causationId);
}

// ─── Deprecate ─────────────────────────────────────────────────────────────────

export async function deprecatePersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const current = await getPersonalEffectiveness(effectivenessId, pmUserId);
  if (!current.ok) return current;

  if (current.data.effectiveness_status === "validated") {
    return failed("Validated personal effectiveness records cannot be deprecated.", "governance_violation");
  }
  if (current.data.effectiveness_status === "archived") {
    return failed("Archived personal effectiveness records cannot be deprecated.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_effectiveness")
    .update({ effectiveness_status: "deprecated" })
    .eq("id", effectivenessId)
    .eq("pm_user_id", pmUserId)
    .select(RECORD_COLUMNS)
    .single<PersonalEffectivenessRecord>();
  if (error || !data) return failed("Unable to deprecate personal effectiveness record.");

  return emitEvent(data, "PERSONAL_EFFECTIVENESS_DEPRECATED", actorId, correlationId, causationId);
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deletePersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<PersonalEffectivenessResult<{ id: string }>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const current = await getPersonalEffectiveness(effectivenessId, pmUserId);
  if (!current.ok) return current as PersonalEffectivenessResult<{ id: string }>;

  if (current.data.effectiveness_status === "validated") {
    return failed("Validated personal effectiveness records cannot be deleted.", "governance_violation");
  }

  // Emit before delete so we have the record data for the event.
  const emitResult = await emitEvent(
    current.data,
    "PERSONAL_EFFECTIVENESS_DELETED",
    actorId,
    correlationId,
    causationId,
  );
  if (!emitResult.ok) return emitResult as PersonalEffectivenessResult<{ id: string }>;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("personal_pm_effectiveness")
    .delete()
    .eq("id", effectivenessId)
    .eq("pm_user_id", pmUserId);
  if (error) return failed("Unable to delete personal effectiveness record.");

  return { ok: true, data: { id: effectivenessId } };
}

// ─── Observations ──────────────────────────────────────────────────────────────

export async function recordPersonalEffectivenessObservation(input: {
  effectivenessId: string;
  pmUserId: string;
  observationSummary: string;
  recordedBy?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<PersonalEffectivenessResult<PersonalEffectivenessObservation>> {
  if (!validUuid(input.effectivenessId)) return validation("effectivenessId must be a UUID.");
  if (!validUuid(input.pmUserId)) return validation("pmUserId must be a UUID.");
  if (!required(input.observationSummary)) return validation("observationSummary is required.");

  const current = await getPersonalEffectiveness(input.effectivenessId, input.pmUserId);
  if (!current.ok) return current as PersonalEffectivenessResult<PersonalEffectivenessObservation>;

  if (current.data.effectiveness_status === "validated") {
    return failed("Observations cannot be added to validated effectiveness records.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("personal_pm_effectiveness_observations")
    .insert({
      effectiveness_id: input.effectivenessId,
      observation_summary: input.observationSummary.trim(),
      recorded_by: input.recordedBy ?? null,
      metadata: input.metadata ?? {},
    })
    .select(OBSERVATION_COLUMNS)
    .single<PersonalEffectivenessObservation>();
  if (error || !data) return failed("Unable to record effectiveness observation.");

  await emitEvent(
    current.data,
    "PERSONAL_EFFECTIVENESS_OBSERVATION_RECORDED",
    input.recordedBy,
    input.correlationId,
    input.causationId,
    { observationId: data.id },
  );

  return { ok: true, data };
}

// ─── Explain ───────────────────────────────────────────────────────────────────

export async function explainPersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessExplanation>> {
  const record = await getPersonalEffectiveness(effectivenessId, pmUserId);
  if (!record.ok) return record as PersonalEffectivenessResult<PersonalEffectivenessExplanation>;

  const supabase = await createSupabaseServerClient();

  const [obsResult, srcResult, eventsResult] = await Promise.all([
    supabase
      .from("personal_pm_effectiveness_observations")
      .select(OBSERVATION_COLUMNS)
      .eq("effectiveness_id", effectivenessId)
      .order("recorded_at", { ascending: true })
      .returns<PersonalEffectivenessObservation[]>(),
    supabase
      .from("personal_pm_effectiveness_sources")
      .select(SOURCE_COLUMNS)
      .eq("effectiveness_id", effectivenessId)
      .order("created_at", { ascending: true })
      .returns<PersonalEffectivenessSource[]>(),
    getPlatformEvents({ workspaceId: record.data.workspace_id }),
  ]);

  const observations = obsResult.data ?? [];
  const sources = srcResult.data ?? [];
  const allEvents = eventsResult.ok ? eventsResult.events : [];
  const supportingEvents = allEvents.filter(
    (e: (typeof allEvents)[number]) => e.raw_reference_id === effectivenessId || e.correlation_id === effectivenessId,
  );

  const resolved = await resolvePersonalEffectivenessSources(record.data, sources);

  return {
    ok: true,
    data: {
      effectiveness: record.data,
      observations,
      sources,
      supportingEvents,
      supportingDecisions: resolved.decisions,
      supportingDecisionEffectiveness: resolved.decisionEffectiveness,
      supportingOrganizationalPatterns: resolved.organizationalPatterns,
      supportingOrganizationalMemory: resolved.organizationalMemory,
      supportingPersonalMemory: resolved.personalMemory,
      supportingPersonalPatterns: resolved.personalPatterns,
      supportingOutcomes: resolved.outcomes,
      unresolvedSources: resolved.unresolvedSources,
    },
  };
}

// ─── Lineage ───────────────────────────────────────────────────────────────────

export async function buildPersonalEffectivenessLineage(
  effectivenessId: string,
  pmUserId: string,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessLineage>> {
  const explanation = await explainPersonalEffectiveness(effectivenessId, pmUserId);
  if (!explanation.ok) return explanation as PersonalEffectivenessResult<PersonalEffectivenessLineage>;

  const d = explanation.data;
  return {
    ok: true,
    data: {
      effectiveness: d.effectiveness,
      observations: d.observations,
      sources: d.sources,
      events: d.supportingEvents,
      decisions: d.supportingDecisions,
      decisionEffectiveness: d.supportingDecisionEffectiveness,
      organizationalPatterns: d.supportingOrganizationalPatterns,
      organizationalMemory: d.supportingOrganizationalMemory,
      personalMemory: d.supportingPersonalMemory,
      personalPatterns: d.supportingPersonalPatterns,
      outcomes: d.supportingOutcomes,
      unresolvedSources: d.unresolvedSources,
      timeline: d.effectiveness.created_at,
    },
  };
}

// ─── Export ────────────────────────────────────────────────────────────────────

export async function exportPersonalEffectiveness(
  effectivenessId: string,
  pmUserId: string,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessExport>> {
  const lineageResult = await buildPersonalEffectivenessLineage(effectivenessId, pmUserId);
  if (!lineageResult.ok) return lineageResult as PersonalEffectivenessResult<PersonalEffectivenessExport>;

  const lineage = lineageResult.data;
  return {
    ok: true,
    data: {
      effectiveness: lineage.effectiveness,
      observations: lineage.observations,
      sources: lineage.sources,
      lineage,
      unresolvedSources: lineage.unresolvedSources,
    },
  };
}

// ─── Health ────────────────────────────────────────────────────────────────────

export async function getPersonalEffectivenessHealth(
  workspaceId: string,
  pmUserId: string,
): Promise<PersonalEffectivenessResult<PersonalEffectivenessHealth>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(pmUserId)) return validation("pmUserId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const [recordsResult, sourcesResult, obsCountResult] = await Promise.all([
    supabase
      .from("personal_pm_effectiveness")
      .select(RECORD_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("pm_user_id", pmUserId)
      .returns<PersonalEffectivenessRecord[]>(),
    supabase
      .from("personal_pm_effectiveness_sources")
      .select(SOURCE_COLUMNS)
      .returns<PersonalEffectivenessSource[]>(),
    supabase
      .from("personal_pm_effectiveness_observations")
      .select("effectiveness_id")
      .returns<{ effectiveness_id: string }[]>(),
  ]);

  const records = recordsResult.data ?? [];
  const sources = sourcesResult.data ?? [];
  const observationRows = obsCountResult.data ?? [];

  const total = records.length;
  const recordIds = new Set(records.map((r: PersonalEffectivenessRecord) => r.id));

  // Filter sources/obs to this PM's records only.
  const mySources = sources.filter((s: PersonalEffectivenessSource) => recordIds.has(s.effectiveness_id));
  const myObs = observationRows.filter((o: { effectiveness_id: string }) => recordIds.has(o.effectiveness_id));

  const recordsWithSource = new Set(mySources.map((s: PersonalEffectivenessSource) => s.effectiveness_id)).size;
  // lineageCoverage: records that have at least one source pointing to a decision, decision_effectiveness, outcome, or platform_event
  const lineageSourceTypes = new Set(["decision", "decision_effectiveness", "outcome", "platform_event"]);
  const recordsWithLineage = new Set(
    mySources.filter((s: PersonalEffectivenessSource) => lineageSourceTypes.has(s.source_type)).map((s: PersonalEffectivenessSource) => s.effectiveness_id),
  ).size;

  const candidateCount = records.filter((r: PersonalEffectivenessRecord) => r.effectiveness_status === "candidate").length;
  const validatedCount = records.filter((r: PersonalEffectivenessRecord) => r.effectiveness_status === "validated").length;
  const archivedCount = records.filter((r: PersonalEffectivenessRecord) => r.effectiveness_status === "archived").length;
  const deprecatedCount = records.filter((r: PersonalEffectivenessRecord) => r.effectiveness_status === "deprecated").length;

  const successCount = records.filter((r: PersonalEffectivenessRecord) => r.outcome_classification === "success").length;
  const partialSuccessCount = records.filter((r: PersonalEffectivenessRecord) => r.outcome_classification === "partial_success").length;
  const failureCount = records.filter((r: PersonalEffectivenessRecord) => r.outcome_classification === "failure").length;
  const unknownCount = records.filter((r: PersonalEffectivenessRecord) => r.outcome_classification === "unknown").length;

  return {
    ok: true,
    data: {
      candidateCount,
      validatedCount,
      archivedCount,
      deprecatedCount,
      observationCount: myObs.length,
      sourceCoverage: total === 0 ? 0 : clamp(recordsWithSource / total),
      lineageCoverage: total === 0 ? 0 : clamp(recordsWithLineage / total),
      successCount,
      partialSuccessCount,
      failureCount,
      unknownCount,
    },
  };
}
