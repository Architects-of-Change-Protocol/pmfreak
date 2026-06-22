// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Feedback Registry — Sprint 5
// Records user feedback on recommendation applications and provides listing.
// ─────────────────────────────────────────────────────────────────────────────

import { createPlatformEvent } from "@/lib/platform-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  ConstitutionalRecommendationFeedbackRow,
  ConstitutionalRecommendationEventType,
  RecommendationResult,
  SubmitFeedbackInput,
  ListFeedbackInput,
} from "./types";

const feedbackColumns = CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SELECTABLE_COLUMNS.join(",");

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

// ─── submitRecommendationFeedback ─────────────────────────────────────────────

export async function submitRecommendationFeedback(
  input: SubmitFeedbackInput,
): Promise<RecommendationResult<ConstitutionalRecommendationFeedbackRow>> {
  if (!validUuid(input.workspaceId))      return validation("workspaceId must be a UUID.");
  if (!validUuid(input.actorId))          return validation("actorId must be a UUID.");
  if (!validUuid(input.recommendationId)) return validation("recommendationId must be a UUID.");
  if (!validUuid(input.applicationId))    return validation("applicationId must be a UUID.");
  if (!input.feedbackType)                return validation("feedbackType is required.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    return validation("rating must be an integer between 1 and 5.");
  }

  const supabase = await createSupabaseServerClient();

  // Verify the application belongs to the recommendation and workspace
  const { data: app, error: appError } = await supabase
    .from("constitutional_recommendation_applications")
    .select("id")
    .eq("id", input.applicationId)
    .eq("workspace_id", input.workspaceId)
    .eq("recommendation_id", input.recommendationId)
    .single();

  if (appError || !app) {
    return failed("Application not found or does not belong to this recommendation.", "not_found");
  }

  const { data, error } = await supabase
    .from("constitutional_recommendation_feedback")
    .insert({
      workspace_id: input.workspaceId,
      recommendation_id: input.recommendationId,
      application_id: input.applicationId,
      feedback_type: input.feedbackType,
      rating: input.rating,
      comments: input.comments ?? null,
      submitted_by: input.actorId,
    })
    .select(feedbackColumns)
    .single<ConstitutionalRecommendationFeedbackRow>();

  if (error || !data) return failed("Unable to submit feedback.");

  const emitted = await emitEvent(
    input.workspaceId,
    input.actorId,
    input.recommendationId,
    "CONSTITUTIONAL_RECOMMENDATION_FEEDBACK_SUBMITTED",
    {
      feedbackId: data.id,
      recommendationId: input.recommendationId,
      applicationId: input.applicationId,
      feedbackType: input.feedbackType,
      rating: input.rating,
    },
  );
  if (!emitted.ok) {
    return { ok: false, error: emitted.error!, failureClass: "event_emission_failed" };
  }

  return { ok: true, data };
}

// ─── listRecommendationFeedback ───────────────────────────────────────────────

export async function listRecommendationFeedback(
  input: ListFeedbackInput,
): Promise<RecommendationResult<ConstitutionalRecommendationFeedbackRow[]>> {
  if (!validUuid(input.workspaceId)) return validation("workspaceId must be a UUID.");

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("constitutional_recommendation_feedback")
    .select(feedbackColumns)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.recommendationId) query = query.eq("recommendation_id", input.recommendationId);
  if (input.feedbackType)     query = query.eq("feedback_type", input.feedbackType);

  const { data, error } = await query;
  if (error) return failed("Unable to list feedback.");
  return {
    ok: true,
    data: (data ?? []) as unknown as ConstitutionalRecommendationFeedbackRow[],
  };
}
