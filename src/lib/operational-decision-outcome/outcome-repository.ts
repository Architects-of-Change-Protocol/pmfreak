import {
  OPERATIONAL_DECISION_OUTCOME_SELECTABLE_COLUMNS,
  OPERATIONAL_OUTCOME_OBSERVATION_SELECTABLE_COLUMNS,
  OPERATIONAL_OUTCOME_EFFECT_SELECTABLE_COLUMNS,
  OPERATIONAL_LEARNING_FEEDBACK_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OutcomeResult,
  OperationalDecisionOutcomeRow,
  OperationalOutcomeObservationRow,
  OperationalOutcomeEffectRow,
  OperationalLearningFeedbackRow,
  OutcomeStatus,
  RecommendationQuality,
  OutcomeObservationType,
  OutcomeEffectType,
  LearningFeedbackType,
  ListDecisionOutcomesInput,
} from "./types";

const OUTCOME_COLS     = OPERATIONAL_DECISION_OUTCOME_SELECTABLE_COLUMNS.join(",");
const OBSERVATION_COLS = OPERATIONAL_OUTCOME_OBSERVATION_SELECTABLE_COLUMNS.join(",");
const EFFECT_COLS      = OPERATIONAL_OUTCOME_EFFECT_SELECTABLE_COLUMNS.join(",");
const LEARNING_COLS    = OPERATIONAL_LEARNING_FEEDBACK_SELECTABLE_COLUMNS.join(",");

function persistence<T>(msg: string): OutcomeResult<T> {
  return { ok: false, error: msg, failureClass: "persistence_failed" };
}

// ─── Outcomes ─────────────────────────────────────────────────────────────────

export async function dbCreateOutcome(params: {
  workspaceId: string;
  decisionId: string;
  expectedImpactScore: number;
}): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_outcomes")
    .insert({
      workspace_id: params.workspaceId,
      decision_id: params.decisionId,
      expected_impact_score: params.expectedImpactScore,
      outcome_status: "pending",
    })
    .select(OUTCOME_COLS)
    .single<OperationalDecisionOutcomeRow>();
  if (error || !data) return persistence("Failed to create decision outcome.");
  return { ok: true, data };
}

export async function dbFindOutcomeById(
  outcomeId: string,
  workspaceId: string
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_outcomes")
    .select(OUTCOME_COLS)
    .eq("id", outcomeId)
    .eq("workspace_id", workspaceId)
    .single<OperationalDecisionOutcomeRow>();
  if (error || !data) return { ok: false, error: "Outcome not found.", failureClass: "not_found" };
  return { ok: true, data };
}

export async function dbListOutcomes(
  input: ListDecisionOutcomesInput
): Promise<OutcomeResult<OperationalDecisionOutcomeRow[]>> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("operational_decision_outcomes")
    .select(OUTCOME_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.decisionId)            q = q.eq("decision_id", input.decisionId);
  if (input.status)                q = q.eq("outcome_status", input.status);
  if (input.recommendationQuality) q = q.eq("recommendation_quality", input.recommendationQuality);
  if (input.minEffectivenessScore != null) {
    q = q.gte("effectiveness_score", input.minEffectivenessScore);
  }
  if (input.fromDate) q = q.gte("created_at", input.fromDate);
  if (input.toDate)   q = q.lte("created_at", input.toDate);
  if (input.limit)    q = q.limit(input.limit);

  const { data, error } = await q.returns<OperationalDecisionOutcomeRow[]>();
  if (error) return persistence("Failed to list outcomes.");
  return { ok: true, data: data ?? [] };
}

export async function dbUpdateOutcome(
  outcomeId: string,
  workspaceId: string,
  patch: Partial<{
    outcome_status: OutcomeStatus;
    actual_impact_score: number;
    effectiveness_score: number;
    recommendation_quality: RecommendationQuality;
    outcome_variance: number;
    observed_at: string;
    evaluated_at: string;
  }>
): Promise<OutcomeResult<OperationalDecisionOutcomeRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_decision_outcomes")
    .update(patch)
    .eq("id", outcomeId)
    .eq("workspace_id", workspaceId)
    .select(OUTCOME_COLS)
    .single<OperationalDecisionOutcomeRow>();
  if (error || !data) return persistence("Failed to update outcome.");
  return { ok: true, data };
}

// ─── Observations ─────────────────────────────────────────────────────────────

export async function dbCreateObservation(params: {
  workspaceId: string;
  outcomeId: string;
  observationType: OutcomeObservationType;
  observationValue: number;
  observationSource: string;
  observedBy: string;
  observedAt: string;
}): Promise<OutcomeResult<OperationalOutcomeObservationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_outcome_observations")
    .insert({
      workspace_id: params.workspaceId,
      outcome_id: params.outcomeId,
      observation_type: params.observationType,
      observation_value: params.observationValue,
      observation_source: params.observationSource,
      observed_by: params.observedBy,
      observed_at: params.observedAt,
    })
    .select(OBSERVATION_COLS)
    .single<OperationalOutcomeObservationRow>();
  if (error || !data) return persistence("Failed to create outcome observation.");
  return { ok: true, data };
}

export async function dbListObservations(
  outcomeId: string,
  workspaceId: string
): Promise<OutcomeResult<OperationalOutcomeObservationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_outcome_observations")
    .select(OBSERVATION_COLS)
    .eq("outcome_id", outcomeId)
    .eq("workspace_id", workspaceId)
    .order("observed_at", { ascending: false })
    .returns<OperationalOutcomeObservationRow[]>();
  if (error) return persistence("Failed to list observations.");
  return { ok: true, data: data ?? [] };
}

// ─── Effects ──────────────────────────────────────────────────────────────────

export async function dbCreateEffect(params: {
  workspaceId: string;
  outcomeId: string;
  effectType: OutcomeEffectType;
  beforeValue: number;
  afterValue: number;
  improvementPercentage: number;
}): Promise<OutcomeResult<OperationalOutcomeEffectRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_outcome_effects")
    .insert({
      workspace_id: params.workspaceId,
      outcome_id: params.outcomeId,
      effect_type: params.effectType,
      before_value: params.beforeValue,
      after_value: params.afterValue,
      improvement_percentage: params.improvementPercentage,
    })
    .select(EFFECT_COLS)
    .single<OperationalOutcomeEffectRow>();
  if (error || !data) return persistence("Failed to create outcome effect.");
  return { ok: true, data };
}

export async function dbListEffects(
  outcomeId: string,
  workspaceId: string
): Promise<OutcomeResult<OperationalOutcomeEffectRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_outcome_effects")
    .select(EFFECT_COLS)
    .eq("outcome_id", outcomeId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .returns<OperationalOutcomeEffectRow[]>();
  if (error) return persistence("Failed to list effects.");
  return { ok: true, data: data ?? [] };
}

// ─── Learning feedback ────────────────────────────────────────────────────────

export async function dbCreateLearning(params: {
  workspaceId: string;
  outcomeId: string;
  learningType: LearningFeedbackType;
  learningSummary: string;
  confidenceScore: number;
  shouldRecommendAgain: boolean;
}): Promise<OutcomeResult<OperationalLearningFeedbackRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_learning_feedback")
    .insert({
      workspace_id: params.workspaceId,
      outcome_id: params.outcomeId,
      learning_type: params.learningType,
      learning_summary: params.learningSummary,
      confidence_score: params.confidenceScore,
      should_recommend_again: params.shouldRecommendAgain,
    })
    .select(LEARNING_COLS)
    .single<OperationalLearningFeedbackRow>();
  if (error || !data) return persistence("Failed to create learning feedback.");
  return { ok: true, data };
}

export async function dbListLearning(
  outcomeId: string,
  workspaceId: string
): Promise<OutcomeResult<OperationalLearningFeedbackRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_learning_feedback")
    .select(LEARNING_COLS)
    .eq("outcome_id", outcomeId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .returns<OperationalLearningFeedbackRow[]>();
  if (error) return persistence("Failed to list learning feedback.");
  return { ok: true, data: data ?? [] };
}

export async function dbListLearningByWorkspace(
  workspaceId: string,
  limit = 50
): Promise<OutcomeResult<OperationalLearningFeedbackRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_learning_feedback")
    .select(LEARNING_COLS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<OperationalLearningFeedbackRow[]>();
  if (error) return persistence("Failed to list learning feedback for workspace.");
  return { ok: true, data: data ?? [] };
}
