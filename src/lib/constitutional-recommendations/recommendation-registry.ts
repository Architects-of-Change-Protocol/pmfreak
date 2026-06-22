// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Recommendation Engine — Recommendation Registry
// Lifecycle: create → generate → validate → publish → retire
// Apply, get, list, lineage, justification, confidence.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_RECOMMENDATION_EVIDENCE_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_RECOMMENDATION_APPLICATION_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { getRecommendationTemplate } from "./generation-engine";
import { calculateRecommendationConfidence } from "./confidence-engine";
import { generateRecommendationJustification } from "./justification-engine";
import type {
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEvidenceRow,
  ConstitutionalRecommendationApplicationRow,
  ConstitutionalRecommendationEventType,
  RecommendationResult,
  CreateRecommendationInput,
  RecommendationIdInput,
  ApplyRecommendationInput,
  ListRecommendationsInput,
  GenerateRecommendationsFromPatternsInput,
  RecommendationConfidenceBreakdown,
  RecommendationJustification,
  RecommendationLineage,
} from "./types";

const recColumns = CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");
const evidenceColumns = CONSTITUTIONAL_RECOMMENDATION_EVIDENCE_SELECTABLE_COLUMNS.join(",");
const applicationColumns = CONSTITUTIONAL_RECOMMENDATION_APPLICATION_SELECTABLE_COLUMNS.join(",");
const patternColumns = CONSTITUTIONAL_LEARNING_PATTERN_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validUuid(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value)
  );
}

function validation<T>(error: string): RecommendationResult<T> {
  return { ok: false, error, failureClass: "validation_failed" };
}

function failed<T>(
  error: string,
  failureClass: Extract<
    RecommendationResult<never>,
    { ok: false }
  >["failureClass"] = "persistence_failed",
): RecommendationResult<T> {
  return { ok: false, error, failureClass };
}

async function emitRecommendationEvent(
  workspaceId: string,
  actorId: string,
  recommendationId: string,
  eventType: ConstitutionalRecommendationEventType,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return createPlatformEvent({
    workspaceId,
    actorId,
    actorType: "user",
    eventType,
    eventCategory: "governance",
    source: "user_action",
    correlationId: recommendationId,
    causationId: null,
    rawReferenceTable: "constitutional_recommendations",
    rawReferenceId: recommendationId,
    learningEligible: true,
    visibility: "workspace",
    sensitivityLevel: "internal",
    eventPayload: payload,
  });
}

// ─── createRecommendation ─────────────────────────────────────────────────────

export async function createRecommendation(
  input: CreateRecommendationInput,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!input.recommendationKey?.trim()) return validation("recommendationKey is required.");
  if (!input.recommendationType) return validation("recommendationType is required.");
  if (!input.recommendationScope) return validation("recommendationScope is required.");
  if (!input.title?.trim()) return validation("title is required.");
  if (!input.description?.trim()) return validation("description is required.");
  if (!input.recommendationText?.trim()) return validation("recommendationText is required.");

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("constitutional_recommendations")
    .insert({
      workspace_id: input.workspaceId,
      recommendation_key: input.recommendationKey.trim(),
      recommendation_type: input.recommendationType,
      recommendation_scope: input.recommendationScope,
      title: input.title.trim(),
      description: input.description.trim(),
      recommendation_text: input.recommendationText.trim(),
      confidence_score: input.initialConfidence ?? 0.0,
      supporting_pattern_count: 0,
      status: "draft",
    })
    .select(recColumns)
    .single<ConstitutionalRecommendationRow>();

  if (error || !data) {
    if (error?.code === "23505") {
      return failed(
        "A recommendation with this key already exists.",
        "governance_violation",
      );
    }
    return failed("Unable to create recommendation.");
  }

  const emitted = await emitRecommendationEvent(
    input.workspaceId,
    input.actorId,
    data.id,
    "CONSTITUTIONAL_RECOMMENDATION_CREATED",
    {
      recommendationId: data.id,
      recommendationKey: data.recommendation_key,
      recommendationType: data.recommendation_type,
      recommendationScope: data.recommendation_scope,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data };
}

// ─── generateRecommendation ───────────────────────────────────────────────────
// Builds a recommendation from a single Learning Pattern via template lookup.

export async function generateRecommendation(
  patternId: string,
  workspaceId: string,
  actorId: string,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(patternId)) return validation("patternId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  type PatternRow = {
    id: string;
    workspace_id: string;
    pattern_type: string;
    pattern_key: string;
    description: string;
    confidence_score: number;
    occurrence_count: number;
    created_at: string;
    updated_at: string;
  };

  const { data: pattern, error: patternError } = await supabase
    .from("constitutional_learning_patterns")
    .select(patternColumns)
    .eq("id", patternId)
    .eq("workspace_id", workspaceId)
    .single<PatternRow>();

  if (patternError || !pattern) {
    return failed("Learning pattern not found.", "not_found");
  }

  const template = getRecommendationTemplate(
    pattern.pattern_type,
    pattern.pattern_key,
    pattern.confidence_score,
  );

  // Upsert: a recommendation for this pattern key may already exist
  const { data: existing } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("workspace_id", workspaceId)
    .eq("recommendation_key", template.recommendationKey)
    .is("deleted_at", null)
    .single<ConstitutionalRecommendationRow>();

  let recommendation: ConstitutionalRecommendationRow;

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("constitutional_recommendations")
      .update({
        recommendation_text: template.recommendationText,
        confidence_score: template.baseConfidence,
        status: "generated",
        description: template.description,
      })
      .eq("id", existing.id)
      .eq("workspace_id", workspaceId)
      .select(recColumns)
      .single<ConstitutionalRecommendationRow>();

    if (updateError || !updated) return failed("Unable to update existing recommendation.");
    recommendation = updated;
  } else {
    const { data: created, error: createError } = await supabase
      .from("constitutional_recommendations")
      .insert({
        workspace_id: workspaceId,
        recommendation_key: template.recommendationKey,
        recommendation_type: template.recommendationType,
        recommendation_scope: template.recommendationScope,
        title: template.title,
        description: template.description,
        recommendation_text: template.recommendationText,
        confidence_score: template.baseConfidence,
        supporting_pattern_count: 1,
        status: "generated",
      })
      .select(recColumns)
      .single<ConstitutionalRecommendationRow>();

    if (createError || !created) return failed("Unable to persist generated recommendation.");
    recommendation = created;
  }

  // Link evidence
  await supabase
    .from("constitutional_recommendation_evidence")
    .upsert(
      {
        workspace_id: workspaceId,
        recommendation_id: recommendation.id,
        learning_pattern_id: patternId,
        contribution_weight: pattern.confidence_score,
      },
      { onConflict: "recommendation_id,learning_pattern_id" },
    );

  const emitted = await emitRecommendationEvent(
    workspaceId,
    actorId,
    recommendation.id,
    "CONSTITUTIONAL_RECOMMENDATION_GENERATED",
    {
      recommendationId: recommendation.id,
      recommendationKey: recommendation.recommendation_key,
      patternId,
      patternKey: pattern.pattern_key,
      confidenceScore: recommendation.confidence_score,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: recommendation };
}

// ─── generateRecommendationsFromPatterns ─────────────────────────────────────
// Batch generation across all (or filtered) patterns in a workspace.

export async function generateRecommendationsFromPatterns(
  input: GenerateRecommendationsFromPatternsInput,
): Promise<RecommendationResult<ConstitutionalRecommendationRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  type PatternRow = {
    id: string;
    workspace_id: string;
    pattern_type: string;
    pattern_key: string;
    description: string;
    confidence_score: number;
    occurrence_count: number;
    created_at: string;
    updated_at: string;
  };

  let query = supabase
    .from("constitutional_learning_patterns")
    .select(patternColumns)
    .eq("workspace_id", input.workspaceId);

  if (input.patternIds?.length) {
    query = query.in("id", input.patternIds);
  }
  if (input.minPatternConfidence !== undefined) {
    query = query.gte("confidence_score", input.minPatternConfidence);
  }

  const { data: patterns, error: patternsError } = await query;
  if (patternsError) return failed("Unable to fetch learning patterns.");

  const typedPatterns = (patterns ?? []) as unknown as PatternRow[];
  if (typedPatterns.length === 0) {
    return { ok: true, data: [] };
  }

  const results: ConstitutionalRecommendationRow[] = [];

  for (const pattern of typedPatterns) {
    const result = await generateRecommendation(pattern.id, input.workspaceId, input.actorId);
    if (result.ok) {
      results.push(result.data);
    }
  }

  return { ok: true, data: results };
}

// ─── validateRecommendation ───────────────────────────────────────────────────
// Rule 3: Cannot publish without evidence.
// Rule 4: Cannot publish without confidence score.

export async function validateRecommendation(
  input: RecommendationIdInput,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");
  if (rec.status === "retired") {
    return failed("Retired recommendations cannot be validated.", "governance_violation");
  }

  // Rule 4: must have confidence > 0
  if (rec.confidence_score <= 0) {
    return failed(
      "Cannot validate: confidence score must be greater than 0.",
      "governance_violation",
    );
  }

  // Rule 3: must have at least one evidence record
  const { count: evidenceCount } = await supabase
    .from("constitutional_recommendation_evidence")
    .select("id", { count: "exact", head: true })
    .eq("recommendation_id", input.recommendationId)
    .eq("workspace_id", input.workspaceId);

  if (!evidenceCount || evidenceCount < 1) {
    return failed(
      "Cannot validate: recommendation has no evidence (learning pattern links).",
      "governance_violation",
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("constitutional_recommendations")
    .update({ status: "validated" })
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .select(recColumns)
    .single<ConstitutionalRecommendationRow>();

  if (updateError || !updated) return failed("Unable to validate recommendation.");

  const emitted = await emitRecommendationEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_VALIDATED",
    {
      recommendationId: input.recommendationId,
      confidenceScore: rec.confidence_score,
      evidenceCount,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: updated };
}

// ─── publishRecommendation ────────────────────────────────────────────────────

export async function publishRecommendation(
  input: RecommendationIdInput,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");

  if (rec.status !== "validated") {
    return failed(
      "Only validated recommendations can be published.",
      "governance_violation",
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("constitutional_recommendations")
    .update({ status: "published" })
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .select(recColumns)
    .single<ConstitutionalRecommendationRow>();

  if (updateError || !updated) return failed("Unable to publish recommendation.");

  const emitted = await emitRecommendationEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_PUBLISHED",
    { recommendationId: input.recommendationId, confidenceScore: rec.confidence_score },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: updated };
}

// ─── retireRecommendation ─────────────────────────────────────────────────────
// Soft retirement only — Rule 8.

export async function retireRecommendation(
  input: RecommendationIdInput,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");
  if (rec.status === "retired") {
    return failed("Recommendation is already retired.", "governance_violation");
  }

  const { data: updated, error: updateError } = await supabase
    .from("constitutional_recommendations")
    .update({
      status: "retired",
      deleted_at: new Date().toISOString(),
    })
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .select(recColumns)
    .single<ConstitutionalRecommendationRow>();

  if (updateError || !updated) return failed("Unable to retire recommendation.");

  const emitted = await emitRecommendationEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_RETIRED",
    { recommendationId: input.recommendationId },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: updated };
}

// ─── applyRecommendation ──────────────────────────────────────────────────────
// Rule 7: Every application must be registered. Rule 9: Does not replace authority.

export async function applyRecommendation(
  input: ApplyRecommendationInput,
): Promise<RecommendationResult<ConstitutionalRecommendationApplicationRow>> {
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId)) return validation("actorId must be a UUID.");
  if (!validUuid(input.entityId)) return validation("entityId must be a UUID.");
  if (!input.entityType) return validation("entityType is required.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");

  if (rec.status !== "published") {
    return failed(
      "Only published recommendations can be applied.",
      "governance_violation",
    );
  }

  const { data: application, error: appError } = await supabase
    .from("constitutional_recommendation_applications")
    .insert({
      workspace_id: input.workspaceId,
      recommendation_id: input.recommendationId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      application_status: "applied",
    })
    .select(applicationColumns)
    .single<ConstitutionalRecommendationApplicationRow>();

  if (appError || !application) return failed("Unable to record recommendation application.");

  const emitted = await emitRecommendationEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_APPLIED",
    {
      recommendationId: input.recommendationId,
      entityType: input.entityType,
      entityId: input.entityId,
      applicationId: application.id,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: application };
}

// ─── getRecommendation ────────────────────────────────────────────────────────

export async function getRecommendation(
  recommendationId: string,
  workspaceId: string,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationRow>();

  if (error || !data) return failed("Recommendation not found.", "not_found");
  return { ok: true, data };
}

// ─── listRecommendations ──────────────────────────────────────────────────────

export async function listRecommendations(
  input: ListRecommendationsInput,
): Promise<RecommendationResult<ConstitutionalRecommendationRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null)
    .order("confidence_score", { ascending: false });

  if (input.type) query = query.eq("recommendation_type", input.type);
  if (input.scope) query = query.eq("recommendation_scope", input.scope);
  if (input.status) query = query.eq("status", input.status);
  if (input.minConfidence !== undefined) {
    query = query.gte("confidence_score", input.minConfidence);
  }

  const { data, error } = await query;
  if (error) return failed("Unable to list recommendations.");
  return {
    ok: true,
    data: (data ?? []) as unknown as ConstitutionalRecommendationRow[],
  };
}

// ─── calculateRecommendationConfidenceForId ───────────────────────────────────

export async function calculateRecommendationConfidenceForId(
  recommendationId: string,
  workspaceId: string,
  actorId: string,
): Promise<RecommendationResult<RecommendationConfidenceBreakdown>> {
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");

  type EvidenceWithPattern = {
    contribution_weight: number;
    learning_pattern_id: string;
    constitutional_learning_patterns: { occurrence_count: number; confidence_score: number } | null;
  };

  const { data: evidenceRows } = await supabase
    .from("constitutional_recommendation_evidence")
    .select(`contribution_weight, learning_pattern_id, constitutional_learning_patterns(occurrence_count, confidence_score)`)
    .eq("recommendation_id", recommendationId)
    .eq("workspace_id", workspaceId);

  const typedEvidence = (evidenceRows ?? []) as unknown as EvidenceWithPattern[];

  const avgWeight =
    typedEvidence.length > 0
      ? typedEvidence.reduce((s, e) => s + e.contribution_weight, 0) / typedEvidence.length
      : 0.5;

  const avgPatternConfidence =
    typedEvidence.length > 0
      ? typedEvidence.reduce((s, e) => s + (e.constitutional_learning_patterns?.confidence_score ?? rec.confidence_score), 0) /
        typedEvidence.length
      : rec.confidence_score;

  const avgOccurrences =
    typedEvidence.length > 0
      ? typedEvidence.reduce((s, e) => s + (e.constitutional_learning_patterns?.occurrence_count ?? 1), 0) /
        typedEvidence.length
      : 1;

  const breakdown = calculateRecommendationConfidence({
    patternConfidence: avgPatternConfidence,
    occurrenceCount: Math.round(avgOccurrences),
    avgContributionWeight: avgWeight,
    evidenceCount: typedEvidence.length,
  });

  const { error: updateError } = await supabase
    .from("constitutional_recommendations")
    .update({ confidence_score: breakdown.overall })
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId);

  if (updateError) return failed("Unable to persist updated confidence score.");

  const emitted = await emitRecommendationEvent(
    workspaceId,
    actorId,
    recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_CALCULATED",
    { recommendationId, ...breakdown },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: breakdown };
}

// ─── getRecommendationJustification ──────────────────────────────────────────

export async function getRecommendationJustification(
  recommendationId: string,
  workspaceId: string,
  actorId: string,
): Promise<RecommendationResult<RecommendationJustification>> {
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");

  type EvidenceRow = { learning_pattern_id: string; contribution_weight: number };
  const { data: evidenceRows } = await supabase
    .from("constitutional_recommendation_evidence")
    .select(evidenceColumns)
    .eq("recommendation_id", recommendationId)
    .eq("workspace_id", workspaceId);

  const typedEvidence = (evidenceRows ?? []) as unknown as EvidenceRow[];

  // Parse patternType and patternKey from recommendation_key
  const parts = rec.recommendation_key.split("::");
  const patternType = parts[0] ?? "outcome_pattern";
  const patternKey = parts.slice(1).join("::") ?? rec.recommendation_key;

  const justification = generateRecommendationJustification({
    recommendation: rec,
    patternKey,
    patternType,
    evidenceCount: typedEvidence.length,
  });

  const emitted = await emitRecommendationEvent(
    workspaceId,
    actorId,
    recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_JUSTIFIED",
    { recommendationId, patternKey, patternType, evidenceCount: typedEvidence.length },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: justification };
}

// ─── getRecommendationLineage ─────────────────────────────────────────────────
// Reconstructs: Artifact → Memory → Digest → Learning Pattern → Recommendation

export async function getRecommendationLineage(
  recommendationId: string,
  workspaceId: string,
  actorId: string,
): Promise<RecommendationResult<RecommendationLineage[]>> {
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(workspaceId)) return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId)) return validation("actorId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec, error: recError } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationRow>();

  if (recError || !rec) return failed("Recommendation not found.", "not_found");

  // Get evidence: which patterns support this recommendation
  type EvidenceRow = { learning_pattern_id: string };
  const { data: evidenceRows } = await supabase
    .from("constitutional_recommendation_evidence")
    .select(evidenceColumns)
    .eq("recommendation_id", recommendationId)
    .eq("workspace_id", workspaceId);

  if (!evidenceRows || evidenceRows.length === 0) {
    return { ok: true, data: [] };
  }

  const typedEvidence = evidenceRows as unknown as EvidenceRow[];
  const patternIds = typedEvidence.map((e) => e.learning_pattern_id);

  type PatternRow = {
    id: string;
    workspace_id: string;
    pattern_type: string;
    pattern_key: string;
    description: string;
    confidence_score: number;
    occurrence_count: number;
    created_at: string;
    updated_at: string;
  };

  const { data: patterns } = await supabase
    .from("constitutional_learning_patterns")
    .select(patternColumns)
    .in("id", patternIds)
    .eq("workspace_id", workspaceId);

  if (!patterns || patterns.length === 0) {
    return failed("Supporting learning patterns not found.", "not_found");
  }

  const typedPatterns = patterns as unknown as PatternRow[];

  // Get learning evidence to find digest IDs
  type LearningEvidenceRow = { digest_id: string; learning_pattern_id: string };
  const { data: learningEvidence } = await supabase
    .from("constitutional_learning_evidence")
    .select("digest_id,learning_pattern_id")
    .in("learning_pattern_id", patternIds)
    .eq("workspace_id", workspaceId);

  if (!learningEvidence || learningEvidence.length === 0) {
    return failed("Learning evidence not found.", "not_found");
  }

  const typedLearningEvidence = learningEvidence as unknown as LearningEvidenceRow[];
  const digestIds = [...new Set(typedLearningEvidence.map((e) => e.digest_id))];

  type DigestRow = {
    id: string;
    workspace_id: string;
    memory_record_id: string;
    digest_status: string;
    digest_payload: Record<string, unknown>;
    confidence_score: number | null;
    created_at: string;
  };

  const { data: digests } = await supabase
    .from("constitutional_digests")
    .select("id,workspace_id,memory_record_id,digest_status,digest_payload,confidence_score,created_at")
    .in("id", digestIds)
    .eq("workspace_id", workspaceId);

  if (!digests || digests.length === 0) {
    return failed("Digest records for lineage not found.", "not_found");
  }

  const typedDigests = digests as unknown as DigestRow[];
  const memoryIds = [...new Set(typedDigests.map((d) => d.memory_record_id))];

  type MemoryRow = {
    id: string;
    workspace_id: string;
    artifact_id: string;
    memory_type: string;
    title: string;
    canonical_text: string;
    summary: string | null;
    created_at: string;
    created_by: string;
  };

  const { data: memories } = await supabase
    .from("constitutional_memory_records")
    .select("id,workspace_id,artifact_id,memory_type,title,canonical_text,summary,created_at,created_by")
    .in("id", memoryIds)
    .eq("workspace_id", workspaceId);

  if (!memories || memories.length === 0) {
    return failed("Memory records for lineage not found.", "not_found");
  }

  const typedMemories = memories as unknown as MemoryRow[];
  const artifactIds = [...new Set(typedMemories.map((m) => m.artifact_id))];

  type ArtifactRow = {
    id: string;
    workspace_id: string;
    artifact_type: string;
    title: string;
    storage_provider: string;
    storage_reference: string;
    checksum: string;
    created_at: string;
  };

  const { data: artifacts } = await supabase
    .from("constitutional_artifacts")
    .select("id,workspace_id,artifact_type,title,storage_provider,storage_reference,checksum,created_at")
    .in("id", artifactIds)
    .eq("workspace_id", workspaceId);

  if (!artifacts || artifacts.length === 0) {
    return failed("Artifact records for lineage not found.", "not_found");
  }

  const typedArtifacts = artifacts as unknown as ArtifactRow[];

  // Build lookup maps
  const patternById = new Map(typedPatterns.map((p) => [p.id, p]));
  const memoryById = new Map(typedMemories.map((m) => [m.id, m]));
  const artifactById = new Map(typedArtifacts.map((a) => [a.id, a]));
  const patternForDigest = new Map(
    typedLearningEvidence.map((le) => [le.digest_id, le.learning_pattern_id]),
  );

  const lineages: RecommendationLineage[] = [];

  for (const digest of typedDigests) {
    const memory = memoryById.get(digest.memory_record_id);
    if (!memory) continue;
    const artifact = artifactById.get(memory.artifact_id);
    if (!artifact) continue;
    const patternId = patternForDigest.get(digest.id);
    if (!patternId) continue;
    const pattern = patternById.get(patternId);
    if (!pattern) continue;

    lineages.push({
      artifact,
      memoryRecord: memory,
      digest,
      learningPattern: pattern,
      recommendation: rec,
    });
  }

  const emitted = await emitRecommendationEvent(
    workspaceId,
    actorId,
    recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_LINEAGE_GENERATED",
    { recommendationId, lineageCount: lineages.length },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: lineages };
}
