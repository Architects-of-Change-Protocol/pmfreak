import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXECUTION_REALITY_SELECTABLE_COLUMNS,
  EXECUTION_VARIANCE_SELECTABLE_COLUMNS,
  EXECUTION_OBSERVATION_SELECTABLE_COLUMNS,
  EXECUTION_DRIFT_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  ExecutionRealityRow,
  ExecutionVarianceRow,
  ExecutionObservationRow,
  ExecutionDriftRow,
} from "@/lib/db/database-contract";
import type {
  ExecutionRealityResult,
  ExecutionRealityStatus,
  ExecutionRealityRisk,
  ExecutionVarianceType,
  ExecutionVarianceSeverity,
  ExecutionDriftType,
  ExecutionDriftSeverity,
  ListRealitiesInput,
} from "./types";

const REALITY_COLS = EXECUTION_REALITY_SELECTABLE_COLUMNS.join(",");
const VARIANCE_COLS = EXECUTION_VARIANCE_SELECTABLE_COLUMNS.join(",");
const OBS_COLS = EXECUTION_OBSERVATION_SELECTABLE_COLUMNS.join(",");
const DRIFT_COLS = EXECUTION_DRIFT_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ExecutionRealityResult<T> {
  return { ok: false, error: "Execution reality not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ExecutionRealityResult<T> {
  return { ok: false, error: `Unable to ${action} execution reality.`, failureClass: "persistence_failed" };
}

// ─── Realities ────────────────────────────────────────────────────────────────

export async function dbCreateExecutionReality(input: {
  workspaceId: string;
  projectionId: string;
  realityTitle: string;
  realityDescription: string;
  actualEffortHours: number;
  actualDurationDays: number;
  actualRisk: ExecutionRealityRisk;
  actualTaskCount: number;
  actualParticipantCount: number;
  confidenceScore: number;
}): Promise<ExecutionRealityResult<ExecutionRealityRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_realities")
    .insert({
      workspace_id:            input.workspaceId,
      projection_id:           input.projectionId,
      reality_title:           input.realityTitle,
      reality_description:     input.realityDescription,
      status:                  "observed",
      actual_effort_hours:     input.actualEffortHours,
      actual_duration_days:    input.actualDurationDays,
      actual_risk:             input.actualRisk,
      actual_task_count:       input.actualTaskCount,
      actual_participant_count: input.actualParticipantCount,
      confidence_score:        input.confidenceScore,
      observed_at:             now,
    })
    .select(REALITY_COLS)
    .single<ExecutionRealityRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindExecutionRealityById(
  id: string,
  workspaceId: string
): Promise<ExecutionRealityResult<ExecutionRealityRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_realities")
    .select(REALITY_COLS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single<ExecutionRealityRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListExecutionRealities(
  input: ListRealitiesInput
): Promise<ExecutionRealityResult<ExecutionRealityRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("execution_realities")
    .select(REALITY_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.status)       query = query.eq("status", input.status);
  if (input.risk)         query = query.eq("actual_risk", input.risk);
  if (input.projectionId) query = query.eq("projection_id", input.projectionId);
  if (input.fromDate)     query = query.gte("created_at", input.fromDate);
  if (input.toDate)       query = query.lte("created_at", input.toDate);

  const { data, error } = await query.returns<ExecutionRealityRow[]>();
  if (error) return persistFailed("list");
  return { ok: true, data: data ?? [] };
}

export async function dbUpdateExecutionReality(
  id: string,
  workspaceId: string,
  updates: Partial<{
    status: ExecutionRealityStatus;
    confidence_score: number;
    validated_at: string | null;
    completed_at: string | null;
    archived_at: string | null;
  }>
): Promise<ExecutionRealityResult<ExecutionRealityRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_realities")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(REALITY_COLS)
    .single<ExecutionRealityRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

// ─── Observations ─────────────────────────────────────────────────────────────

export async function dbCreateExecutionObservation(input: {
  workspaceId: string;
  realityId: string;
  observationType: string;
  observationValue: string;
  observationSource: string;
  observedBy?: string | null;
}): Promise<ExecutionRealityResult<ExecutionObservationRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_observations")
    .insert({
      workspace_id:       input.workspaceId,
      reality_id:         input.realityId,
      observation_type:   input.observationType,
      observation_value:  input.observationValue,
      observation_source: input.observationSource,
      observed_by:        input.observedBy ?? null,
      observed_at:        now,
    })
    .select(OBS_COLS)
    .single<ExecutionObservationRow>();
  if (error || !data) return persistFailed("create observation");
  return { ok: true, data };
}

export async function dbListExecutionObservations(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<ExecutionObservationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_observations")
    .select(OBS_COLS)
    .eq("reality_id", realityId)
    .eq("workspace_id", workspaceId)
    .order("observed_at", { ascending: false })
    .returns<ExecutionObservationRow[]>();
  if (error) return persistFailed("list observations");
  return { ok: true, data: data ?? [] };
}

// ─── Variances ────────────────────────────────────────────────────────────────

export async function dbCreateExecutionVariance(input: {
  workspaceId: string;
  realityId: string;
  varianceType: ExecutionVarianceType;
  projectedValue: number;
  actualValue: number;
  variancePercentage: number;
  severity: ExecutionVarianceSeverity;
}): Promise<ExecutionRealityResult<ExecutionVarianceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_variances")
    .insert({
      workspace_id:        input.workspaceId,
      reality_id:          input.realityId,
      variance_type:       input.varianceType,
      projected_value:     input.projectedValue,
      actual_value:        input.actualValue,
      variance_percentage: input.variancePercentage,
      severity:            input.severity,
    })
    .select(VARIANCE_COLS)
    .single<ExecutionVarianceRow>();
  if (error || !data) return persistFailed("create variance");
  return { ok: true, data };
}

export async function dbListExecutionVariances(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<ExecutionVarianceRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_variances")
    .select(VARIANCE_COLS)
    .eq("reality_id", realityId)
    .eq("workspace_id", workspaceId)
    .returns<ExecutionVarianceRow[]>();
  if (error) return persistFailed("list variances");
  return { ok: true, data: data ?? [] };
}

// ─── Drifts ───────────────────────────────────────────────────────────────────

export async function dbCreateExecutionDrift(input: {
  workspaceId: string;
  realityId: string;
  driftType: ExecutionDriftType;
  severity: ExecutionDriftSeverity;
  description: string;
}): Promise<ExecutionRealityResult<ExecutionDriftRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_drifts")
    .insert({
      workspace_id: input.workspaceId,
      reality_id:   input.realityId,
      drift_type:   input.driftType,
      severity:     input.severity,
      description:  input.description,
      detected_at:  now,
    })
    .select(DRIFT_COLS)
    .single<ExecutionDriftRow>();
  if (error || !data) return persistFailed("create drift");
  return { ok: true, data };
}

export async function dbListExecutionDrifts(
  realityId: string,
  workspaceId: string
): Promise<ExecutionRealityResult<ExecutionDriftRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_drifts")
    .select(DRIFT_COLS)
    .eq("reality_id", realityId)
    .eq("workspace_id", workspaceId)
    .order("detected_at", { ascending: false })
    .returns<ExecutionDriftRow[]>();
  if (error) return persistFailed("list drifts");
  return { ok: true, data: data ?? [] };
}
