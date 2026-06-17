import { createPlatformEvent, getPlatformEvents } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DecisionEffectivenessComputeInput,
  DecisionEffectivenessEventType,
  DecisionEffectivenessExplanation,
  DecisionEffectivenessExport,
  DecisionEffectivenessLineage,
  DecisionEffectivenessMetrics,
  DecisionEffectivenessObservation,
  DecisionEffectivenessObservationSourceType,
  DecisionEffectivenessObservationType,
  DecisionEffectivenessRecord,
  DecisionEffectivenessResult,
  DecisionOutcomeClassification,
} from "./types";

const effectivenessStatuses = ["candidate", "validated", "archived"] as const;
const outcomeClassifications: DecisionOutcomeClassification[] = ["success", "partial_success", "failure", "unknown"];
const observationSourceTypes: DecisionEffectivenessObservationSourceType[] = [
  "platform_event", "decision", "outcome", "organizational_pattern", "evidence", "implementation",
];
const observationTypes: DecisionEffectivenessObservationType[] = [
  "outcome_recorded", "pattern_linked", "evidence_noted", "implementation_noted",
  "duration_computed", "classification_set", "other",
];

const recordColumns = "id,workspace_id,decision_id,project_id,effectiveness_status,outcome_classification,approval_duration_seconds,implementation_duration_seconds,time_to_outcome_seconds,evidence_count,outcome_count,pattern_count,created_at,updated_at,created_by,metadata";
const observationColumns = "id,effectiveness_id,observation_type,summary,source_type,source_id,recorded_at";

function validUuid(v: string | null | undefined): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function required(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0; }
function validation<T>(error: string): DecisionEffectivenessResult<T> { return { ok: false, error, failureClass: "validation_failed" }; }
function failed<T>(error: string, failureClass = "persistence_failed"): DecisionEffectivenessResult<T> { return { ok: false, error, failureClass }; }

function secondsBetween(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 1000) : null;
}

async function emitEffectivenessEvent(
  record: DecisionEffectivenessRecord,
  eventType: DecisionEffectivenessEventType,
  actorId: string | null | undefined,
  correlationId?: string | null,
  causationId?: string | null,
  extra: Record<string, unknown> = {},
): Promise<DecisionEffectivenessResult<DecisionEffectivenessRecord>> {
  const event = await createPlatformEvent({
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    actorId: actorId ?? record.created_by,
    actorType: (actorId ?? record.created_by) ? "user" : "system",
    eventType,
    eventCategory: "decision",
    source: (actorId ?? record.created_by) ? "user_action" : "system",
    correlationId: correlationId ?? record.decision_id,
    causationId: causationId ?? null,
    rawReferenceTable: "decision_effectiveness",
    rawReferenceId: record.id,
    learningEligible: false,
    eventPayload: {
      effectivenessId: record.id,
      decisionId: record.decision_id,
      effectivenessStatus: record.effectiveness_status,
      outcomeClassification: record.outcome_classification,
      ...extra,
    },
  });
  if (!event.ok) return { ok: false, error: event.error, failureClass: "event_emission_failed" };
  return { ok: true, data: record };
}

// ─── Computation ───────────────────────────────────────────────────────────────

export function computeDecisionEffectiveness(input: DecisionEffectivenessComputeInput): DecisionEffectivenessMetrics {
  const { decision, outcomes, patterns, evidence } = input;

  const approvalDurationSeconds = secondsBetween(decision.created_at, decision.approved_at);
  const implementationDurationSeconds = secondsBetween(decision.approved_at ?? decision.created_at, decision.implemented_at);
  const timeToOutcomeSeconds = secondsBetween(decision.created_at, decision.closed_at ?? decision.implemented_at);

  return {
    approval_duration_seconds: approvalDurationSeconds,
    implementation_duration_seconds: implementationDurationSeconds,
    time_to_outcome_seconds: timeToOutcomeSeconds,
    evidence_count: evidence.length,
    outcome_count: outcomes.length,
    pattern_count: patterns.length,
  };
}

export function classifyOutcome(outcomes: Array<{ outcome_status: string }>): DecisionOutcomeClassification {
  if (!outcomes.length) return "unknown";
  const statuses = outcomes.map((o) => o.outcome_status);
  if (statuses.every((s) => s === "success")) return "success";
  if (statuses.every((s) => s === "failure")) return "failure";
  if (statuses.some((s) => s === "success" || s === "partial_success")) return "partial_success";
  return "unknown";
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function createEffectivenessRecord(input: {
  workspaceId: string;
  decisionId: string;
  projectId: string;
  outcomeClassification: DecisionOutcomeClassification;
  approvalDurationSeconds?: number | null;
  implementationDurationSeconds?: number | null;
  timeToOutcomeSeconds?: number | null;
  evidenceCount?: number;
  outcomeCount?: number;
  patternCount?: number;
  createdBy: string;
  metadata?: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<DecisionEffectivenessResult<DecisionEffectivenessRecord>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.decisionId)) return validation("decisionId must be a UUID.");
  if (!validUuid(input.projectId)) return validation("projectId must be a UUID.");
  if (!validUuid(input.createdBy)) return validation("createdBy must be a UUID.");
  if (!outcomeClassifications.includes(input.outcomeClassification)) {
    return validation(`outcomeClassification must be one of: ${outcomeClassifications.join(", ")}.`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("decision_effectiveness")
    .insert({
      workspace_id: input.workspaceId,
      decision_id: input.decisionId,
      project_id: input.projectId,
      effectiveness_status: "candidate",
      outcome_classification: input.outcomeClassification,
      approval_duration_seconds: input.approvalDurationSeconds ?? null,
      implementation_duration_seconds: input.implementationDurationSeconds ?? null,
      time_to_outcome_seconds: input.timeToOutcomeSeconds ?? null,
      evidence_count: input.evidenceCount ?? 0,
      outcome_count: input.outcomeCount ?? 0,
      pattern_count: input.patternCount ?? 0,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(recordColumns)
    .single<DecisionEffectivenessRecord>();
  if (error || !data) return failed("Unable to create effectiveness record.");

  return emitEffectivenessEvent(data, "DECISION_EFFECTIVENESS_CREATED", input.createdBy, input.correlationId, input.causationId);
}

export async function getEffectivenessRecord(effectivenessId: string): Promise<DecisionEffectivenessResult<DecisionEffectivenessRecord>> {
  if (!validUuid(effectivenessId)) return validation("effectivenessId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("decision_effectiveness")
    .select(recordColumns)
    .eq("id", effectivenessId)
    .single<DecisionEffectivenessRecord>();
  if (error || !data) return failed("Effectiveness record not found.", "not_found");
  return { ok: true, data };
}

export async function listDecisionEffectiveness(workspaceId: string): Promise<DecisionEffectivenessResult<DecisionEffectivenessRecord[]>> {
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("decision_effectiveness")
    .select(recordColumns)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .returns<DecisionEffectivenessRecord[]>();
  if (error || !data) return failed("Unable to list effectiveness records.");
  return { ok: true, data };
}

// ─── Immutability: validated records cannot be edited, only archived ───────────

export async function archiveEffectivenessRecord(
  effectivenessId: string,
  actorId: string,
  correlationId?: string | null,
  causationId?: string | null,
): Promise<DecisionEffectivenessResult<DecisionEffectivenessRecord>> {
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");
  const current = await getEffectivenessRecord(effectivenessId);
  if (!current.ok) return current;
  if (current.data.effectiveness_status === "archived") {
    return failed("Record is already archived.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("decision_effectiveness")
    .update({ effectiveness_status: "archived", updated_at: new Date().toISOString() })
    .eq("id", effectivenessId)
    .select(recordColumns)
    .single<DecisionEffectivenessRecord>();
  if (error || !data) return failed("Unable to archive effectiveness record.");
  return emitEffectivenessEvent(data, "DECISION_EFFECTIVENESS_ARCHIVED", actorId, correlationId, causationId);
}

// ─── Observations ──────────────────────────────────────────────────────────────

export async function recordEffectivenessObservation(input: {
  effectivenessId: string;
  observationType: DecisionEffectivenessObservationType;
  summary: string;
  sourceType: DecisionEffectivenessObservationSourceType;
  sourceId: string;
  actorId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
}): Promise<DecisionEffectivenessResult<DecisionEffectivenessObservation>> {
  if (!validUuid(input.effectivenessId)) return validation("effectivenessId must be a UUID.");
  if (!observationTypes.includes(input.observationType)) return validation(`observationType must be one of: ${observationTypes.join(", ")}.`);
  if (!required(input.summary)) return validation("summary is required.");
  if (!observationSourceTypes.includes(input.sourceType)) return validation(`sourceType must be one of: ${observationSourceTypes.join(", ")}.`);
  if (!validUuid(input.sourceId)) return validation("sourceId must be a UUID.");

  const current = await getEffectivenessRecord(input.effectivenessId);
  if (!current.ok) return current as DecisionEffectivenessResult<DecisionEffectivenessObservation>;
  if (current.data.effectiveness_status === "archived") {
    return failed("Cannot add observations to archived effectiveness records.", "governance_violation");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("decision_effectiveness_observations")
    .insert({
      effectiveness_id: input.effectivenessId,
      observation_type: input.observationType,
      summary: input.summary.trim(),
      source_type: input.sourceType,
      source_id: input.sourceId,
    })
    .select(observationColumns)
    .single<DecisionEffectivenessObservation>();
  if (error || !data) return failed("Unable to record effectiveness observation.");

  await emitEffectivenessEvent(
    current.data,
    "DECISION_EFFECTIVENESS_OBSERVATION_RECORDED",
    input.actorId,
    input.correlationId,
    input.causationId,
    { observationId: data.id, observationType: data.observation_type, sourceType: data.source_type },
  );

  return { ok: true, data };
}

// ─── Explanation ───────────────────────────────────────────────────────────────

export async function explainDecisionEffectiveness(effectivenessId: string): Promise<DecisionEffectivenessResult<DecisionEffectivenessExplanation>> {
  const record = await getEffectivenessRecord(effectivenessId);
  if (!record.ok) return record as DecisionEffectivenessResult<DecisionEffectivenessExplanation>;

  const supabase = await createSupabaseServerClient();

  const [obsResult, decisionResult, outcomeResult, patternResult, evidenceResult] = await Promise.all([
    supabase
      .from("decision_effectiveness_observations")
      .select(observationColumns)
      .eq("effectiveness_id", effectivenessId)
      .order("recorded_at", { ascending: true })
      .returns<DecisionEffectivenessObservation[]>(),
    supabase
      .from("project_decisions")
      .select("id,workspace_id,project_id,decision_type,decision_status,title,summary,created_at,approved_at,implemented_at,closed_at")
      .eq("id", record.data.decision_id)
      .single<Record<string, unknown>>(),
    supabase
      .from("decision_outcomes")
      .select("id,outcome_type,outcome_status,summary,recorded_at")
      .eq("decision_id", record.data.decision_id)
      .returns<Record<string, unknown>[]>(),
    supabase
      .from("organizational_patterns")
      .select("id,pattern_category,status,confidence,title,summary")
      .eq("workspace_id", record.data.workspace_id)
      .returns<Record<string, unknown>[]>(),
    supabase
      .from("decision_evidence_links")
      .select("id,evidence_id,evidence_type,relationship_type,created_at")
      .eq("decision_id", record.data.decision_id)
      .returns<Record<string, unknown>[]>(),
  ]);

  const observations = obsResult.data ?? [];
  const decision = decisionResult.data ?? {};
  const outcomes = outcomeResult.data ?? [];
  const evidence = evidenceResult.data ?? [];

  const outcomeIds = outcomes.map((o) => (o as { id: string }).id);
  const linkedPatterns = (patternResult.data ?? []).filter((p) => {
    const pat = p as { id: string };
    return outcomeIds.some((oid) => oid === pat.id) || record.data.pattern_count > 0;
  });

  const metrics: DecisionEffectivenessMetrics = {
    approval_duration_seconds: record.data.approval_duration_seconds,
    implementation_duration_seconds: record.data.implementation_duration_seconds,
    time_to_outcome_seconds: record.data.time_to_outcome_seconds,
    evidence_count: record.data.evidence_count,
    outcome_count: record.data.outcome_count,
    pattern_count: record.data.pattern_count,
  };

  return {
    ok: true,
    data: {
      record: record.data,
      decision,
      implementation: null,
      outcomes,
      patterns: linkedPatterns,
      evidence,
      metrics,
      observations,
    },
  };
}

// ─── Lineage ───────────────────────────────────────────────────────────────────

export async function buildDecisionEffectivenessLineage(effectivenessId: string): Promise<DecisionEffectivenessResult<DecisionEffectivenessLineage>> {
  const explanation = await explainDecisionEffectiveness(effectivenessId);
  if (!explanation.ok) return explanation as DecisionEffectivenessResult<DecisionEffectivenessLineage>;

  const eventsResult = await getPlatformEvents({ workspaceId: explanation.data.record.workspace_id });
  const events = eventsResult.ok
    ? eventsResult.events.filter(
        (e) =>
          e.raw_reference_id === effectivenessId ||
          e.raw_reference_id === explanation.data.record.decision_id ||
          e.correlation_id === explanation.data.record.decision_id,
      )
    : [];

  return {
    ok: true,
    data: {
      record: explanation.data.record,
      decision: explanation.data.decision,
      implementation: explanation.data.implementation,
      outcomes: explanation.data.outcomes,
      patterns: explanation.data.patterns,
      observations: explanation.data.observations,
      events,
    },
  };
}

// ─── Export ────────────────────────────────────────────────────────────────────

export async function exportEffectivenessRecord(effectivenessId: string): Promise<DecisionEffectivenessResult<DecisionEffectivenessExport>> {
  const lineage = await buildDecisionEffectivenessLineage(effectivenessId);
  if (!lineage.ok) return lineage as DecisionEffectivenessResult<DecisionEffectivenessExport>;

  const record = lineage.data.record;
  const metrics: DecisionEffectivenessMetrics = {
    approval_duration_seconds: record.approval_duration_seconds,
    implementation_duration_seconds: record.implementation_duration_seconds,
    time_to_outcome_seconds: record.time_to_outcome_seconds,
    evidence_count: record.evidence_count,
    outcome_count: record.outcome_count,
    pattern_count: record.pattern_count,
  };

  return {
    ok: true,
    data: {
      record,
      decision: lineage.data.decision,
      implementation: lineage.data.implementation,
      outcomes: lineage.data.outcomes,
      patterns: lineage.data.patterns,
      metrics,
      observations: lineage.data.observations,
      events: lineage.data.events,
    },
  };
}
