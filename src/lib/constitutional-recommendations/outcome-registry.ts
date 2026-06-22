// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Outcome Registry — Sprint 5
// Records recommendation outcomes and aggregates effectiveness.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONSTITUTIONAL_RECOMMENDATION_OUTCOME_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS,
  CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { calculateEffectivenessScore, computeOutcomeEffectivenessScore } from "./effectiveness-engine";
import { adaptRecommendationConfidence } from "./adaptation-engine";
import type {
  ConstitutionalRecommendationOutcomeRow,
  ConstitutionalRecommendationEffectivenessRow,
  ConstitutionalRecommendationRow,
  ConstitutionalRecommendationEventType,
  RecommendationResult,
  RecordOutcomeInput,
  CalculateEffectivenessInput,
  ListOutcomesInput,
  RecommendationEffectivenessBreakdown,
} from "./types";

const outcomeColumns = CONSTITUTIONAL_RECOMMENDATION_OUTCOME_SELECTABLE_COLUMNS.join(",");
const effectivenessColumns = CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_SELECTABLE_COLUMNS.join(",");
const recColumns = CONSTITUTIONAL_RECOMMENDATION_SELECTABLE_COLUMNS.join(",");

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
  failureClass: Extract<RecommendationResult<never>, { ok: false }>["failureClass"] = "persistence_failed",
): RecommendationResult<T> {
  return { ok: false, error, failureClass };
}

async function emitEvent(
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

// ─── recordRecommendationOutcome ──────────────────────────────────────────────
// Rule 1: outcome must originate from a real application.
// Rule 2: no orphan outcomes.
// Rule 6: immutable after creation.

export async function recordRecommendationOutcome(
  input: RecordOutcomeInput,
): Promise<RecommendationResult<ConstitutionalRecommendationOutcomeRow>> {
  if (!validUuid(input.workspaceId))      return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))          return validation("actorId must be a UUID.");
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(input.applicationId))    return validation("applicationId must be a UUID.");
  if (!input.outcomeType)                 return validation("outcomeType is required.");
  if (!input.outcomeStatus)               return validation("outcomeStatus is required.");

  const supabase = await createSupabaseServerClient();

  // Verify the application belongs to this recommendation and workspace (Rule 2)
  const { data: app, error: appError } = await supabase
    .from("constitutional_recommendation_applications")
    .select("id,recommendation_id,workspace_id")
    .eq("id", input.applicationId)
    .eq("workspace_id", input.workspaceId)
    .eq("recommendation_id", input.recommendationId)
    .single();

  if (appError || !app) {
    return failed("Application not found or does not belong to this recommendation.", "not_found");
  }

  const effectivenessScore = computeOutcomeEffectivenessScore(
    input.outcomeStatus,
    input.observedValue ?? null,
    input.expectedValue ?? null,
  );

  const { data, error } = await supabase
    .from("constitutional_recommendation_outcomes")
    .insert({
      workspace_id: input.workspaceId,
      recommendation_id: input.recommendationId,
      application_id: input.applicationId,
      outcome_type: input.outcomeType,
      outcome_status: input.outcomeStatus,
      observed_value: input.observedValue ?? null,
      expected_value: input.expectedValue ?? null,
      effectiveness_score: effectivenessScore,
    })
    .select(outcomeColumns)
    .single<ConstitutionalRecommendationOutcomeRow>();

  if (error || !data) return failed("Unable to record outcome.");

  const emitted = await emitEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_OUTCOME_RECORDED",
    {
      outcomeId: data.id,
      recommendationId: input.recommendationId,
      applicationId: input.applicationId,
      outcomeType: input.outcomeType,
      outcomeStatus: input.outcomeStatus,
      effectivenessScore,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data };
}

// ─── calculateRecommendationEffectiveness ────────────────────────────────────

export async function calculateRecommendationEffectiveness(
  input: CalculateEffectivenessInput,
): Promise<RecommendationResult<RecommendationEffectivenessBreakdown>> {
  if (!validUuid(input.workspaceId))      return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))          return validation("actorId must be a UUID.");
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  type OutcomeRow = {
    outcome_status: string;
    effectiveness_score: number;
  };

  const { data: outcomes, error: outcomesError } = await supabase
    .from("constitutional_recommendation_outcomes")
    .select("outcome_status,effectiveness_score")
    .eq("workspace_id", input.workspaceId)
    .eq("recommendation_id", input.recommendationId);

  if (outcomesError) return failed("Unable to fetch outcomes.");

  type FeedbackRow = { rating: number };
  const { data: feedbacks } = await supabase
    .from("constitutional_recommendation_feedback")
    .select("rating")
    .eq("workspace_id", input.workspaceId)
    .eq("recommendation_id", input.recommendationId);

  const typedOutcomes = (outcomes ?? []) as unknown as OutcomeRow[];
  const typedFeedbacks = (feedbacks ?? []) as unknown as FeedbackRow[];

  const calc = calculateEffectivenessScore({
    outcomes: typedOutcomes.map((o) => ({
      outcomeStatus: o.outcome_status as Parameters<typeof calculateEffectivenessScore>[0]["outcomes"][0]["outcomeStatus"],
      effectivenessScore: o.effectiveness_score,
    })),
    feedbacks: typedFeedbacks.map((f) => ({ rating: f.rating })),
  });

  // Get current confidence for adaptation
  const { data: rec } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", input.recommendationId)
    .eq("workspace_id", input.workspaceId)
    .single<ConstitutionalRecommendationRow>();

  const currentConfidence = rec?.confidence_score ?? 0.5;
  const adaptation = adaptRecommendationConfidence({
    originalConfidence: currentConfidence,
    observedEffectiveness: calc.averageEffectiveness,
    applicationsCount: calc.applicationsCount,
  });

  // Upsert effectiveness record
  await supabase
    .from("constitutional_recommendation_effectiveness")
    .upsert(
      {
        workspace_id: input.workspaceId,
        recommendation_id: input.recommendationId,
        applications_count: calc.applicationsCount,
        successful_count: calc.successfulCount,
        failed_count: calc.failedCount,
        neutral_count: calc.neutralCount,
        average_effectiveness: calc.averageEffectiveness,
        confidence_adjustment: adaptation.confidenceAdjustment,
        last_calculated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,recommendation_id" },
    );

  const emitted = await emitEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_EFFECTIVENESS_CALCULATED",
    {
      recommendationId: input.recommendationId,
      applicationsCount: calc.applicationsCount,
      averageEffectiveness: calc.averageEffectiveness,
      successRate: calc.successRate,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return {
    ok: true,
    data: {
      recommendationId: input.recommendationId,
      applicationsCount: calc.applicationsCount,
      successfulCount: calc.successfulCount,
      failedCount: calc.failedCount,
      neutralCount: calc.neutralCount,
      successRate: calc.successRate,
      failureRate: calc.failureRate,
      neutralRate: calc.neutralRate,
      averageEffectiveness: calc.averageEffectiveness,
      confidenceAdjustment: adaptation.confidenceAdjustment,
    },
  };
}

// ─── adjustRecommendationConfidence ──────────────────────────────────────────
// Rule 3: every adaptation is auditable.
// Rule 7: new confidence ≤ 1.0. Rule 8: new confidence ≥ 0.0.

export async function adjustRecommendationConfidence(
  workspaceId: string,
  actorId: string,
  recommendationId: string,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(workspaceId))      return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId))          return validation("actorId must be a UUID.");
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationRow>();

  if (!rec) return failed("Recommendation not found.", "not_found");

  const { data: effectivenessRow } = await supabase
    .from("constitutional_recommendation_effectiveness")
    .select(effectivenessColumns)
    .eq("recommendation_id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationEffectivenessRow>();

  if (!effectivenessRow) {
    return failed("No effectiveness data found. Run calculateRecommendationEffectiveness first.", "not_found");
  }

  const adaptation = adaptRecommendationConfidence({
    originalConfidence: rec.confidence_score,
    observedEffectiveness: effectivenessRow.average_effectiveness,
    applicationsCount: effectivenessRow.applications_count,
  });

  const { data: updated, error: updateError } = await supabase
    .from("constitutional_recommendations")
    .update({ confidence_score: adaptation.newConfidence })
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .select(recColumns)
    .single<ConstitutionalRecommendationRow>();

  if (updateError || !updated) return failed("Unable to update confidence score.");

  const emitted = await emitEvent(
    workspaceId,
    actorId,
    recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_CONFIDENCE_ADJUSTED",
    {
      recommendationId,
      originalConfidence: adaptation.originalConfidence,
      observedEffectiveness: adaptation.observedEffectiveness,
      confidenceAdjustment: adaptation.confidenceAdjustment,
      newConfidence: adaptation.newConfidence,
      rule: adaptation.rule,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: updated };
}

// ─── getRecommendationEffectiveness ──────────────────────────────────────────

export async function getRecommendationEffectiveness(
  workspaceId: string,
  recommendationId: string,
): Promise<RecommendationResult<ConstitutionalRecommendationEffectivenessRow>> {
  if (!validUuid(workspaceId))      return validation("workspaceId must be a UUID.");
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("constitutional_recommendation_effectiveness")
    .select(effectivenessColumns)
    .eq("workspace_id", workspaceId)
    .eq("recommendation_id", recommendationId)
    .single<ConstitutionalRecommendationEffectivenessRow>();

  if (error || !data) return failed("Effectiveness record not found.", "not_found");
  return { ok: true, data };
}

// ─── listRecommendationOutcomes ───────────────────────────────────────────────

export async function listRecommendationOutcomes(
  input: ListOutcomesInput,
): Promise<RecommendationResult<ConstitutionalRecommendationOutcomeRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("constitutional_recommendation_outcomes")
    .select(outcomeColumns)
    .eq("workspace_id", input.workspaceId)
    .order("observed_at", { ascending: false });

  if (input.recommendationId) query = query.eq("recommendation_id", input.recommendationId);
  if (input.outcomeType)      query = query.eq("outcome_type", input.outcomeType);
  if (input.outcomeStatus)    query = query.eq("outcome_status", input.outcomeStatus);
  if (input.fromDate)         query = query.gte("observed_at", input.fromDate);
  if (input.toDate)           query = query.lte("observed_at", input.toDate);

  const { data, error } = await query;
  if (error) return failed("Unable to list outcomes.");
  return { ok: true, data: (data ?? []) as unknown as ConstitutionalRecommendationOutcomeRow[] };
}

// ─── deprecateRecommendation ──────────────────────────────────────────────────
// Lifecycle extension: published → deprecated if effectiveness < threshold.

export async function deprecateRecommendation(
  workspaceId: string,
  actorId: string,
  recommendationId: string,
  effectivenessThreshold = 0.30,
): Promise<RecommendationResult<ConstitutionalRecommendationRow>> {
  if (!validUuid(workspaceId))      return validation("workspaceId must be a UUID.");
  if (!validUuid(actorId))          return validation("actorId must be a UUID.");
  if (!validUuid(recommendationId)) return validation("recommendationId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  const { data: rec } = await supabase
    .from("constitutional_recommendations")
    .select(recColumns)
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ConstitutionalRecommendationRow>();

  if (!rec) return failed("Recommendation not found.", "not_found");

  if (rec.status !== "published") {
    return failed("Only published recommendations can be deprecated.", "governance_violation");
  }

  const { data: effectivenessRow } = await supabase
    .from("constitutional_recommendation_effectiveness")
    .select(effectivenessColumns)
    .eq("recommendation_id", recommendationId)
    .eq("workspace_id", workspaceId)
    .single<ConstitutionalRecommendationEffectivenessRow>();

  const effectiveness = effectivenessRow?.average_effectiveness ?? 1.0;

  if (effectiveness >= effectivenessThreshold) {
    return failed(
      `Recommendation effectiveness (${effectiveness}) is above the deprecation threshold (${effectivenessThreshold}).`,
      "governance_violation",
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("constitutional_recommendations")
    .update({ status: "deprecated", deleted_at: new Date().toISOString() })
    .eq("id", recommendationId)
    .eq("workspace_id", workspaceId)
    .select(recColumns)
    .single<ConstitutionalRecommendationRow>();

  if (updateError || !updated) return failed("Unable to deprecate recommendation.");

  const emitted = await emitEvent(
    workspaceId,
    actorId,
    recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_DEPRECATED",
    {
      recommendationId,
      effectiveness,
      threshold: effectivenessThreshold,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data: updated };
}
