import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXECUTION_PROJECTION_SELECTABLE_COLUMNS,
  EXECUTION_PROJECTION_TASK_SELECTABLE_COLUMNS,
  EXECUTION_PROJECTION_DEPENDENCY_SELECTABLE_COLUMNS,
  EXECUTION_PROJECTION_PARTICIPANT_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  ExecutionProjectionRow,
  ExecutionProjectionTaskRow,
  ExecutionProjectionDependencyRow,
  ExecutionProjectionParticipantRow,
} from "@/lib/db/database-contract";
import type {
  ExecutionProjectionResult,
  ExecutionProjectionStatus,
  ExecutionProjectionRisk,
  ListProjectionsInput,
} from "./types";

const PROJ_COLS  = EXECUTION_PROJECTION_SELECTABLE_COLUMNS.join(",");
const TASK_COLS  = EXECUTION_PROJECTION_TASK_SELECTABLE_COLUMNS.join(",");
const DEP_COLS   = EXECUTION_PROJECTION_DEPENDENCY_SELECTABLE_COLUMNS.join(",");
const PART_COLS  = EXECUTION_PROJECTION_PARTICIPANT_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ExecutionProjectionResult<T> {
  return { ok: false, error: "Execution projection not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ExecutionProjectionResult<T> {
  return { ok: false, error: `Unable to ${action} execution projection.`, failureClass: "persistence_failed" };
}

// ─── Projections ──────────────────────────────────────────────────────────────

export async function dbCreateExecutionProjection(input: {
  workspaceId: string;
  commitmentId: string;
  projectionTitle: string;
  projectionDescription: string;
  estimatedEffortHours: number;
  estimatedDurationDays: number;
  projectedRisk: ExecutionProjectionRisk;
  confidenceScore: number;
}): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("execution_projections")
    .insert({
      workspace_id:            input.workspaceId,
      commitment_id:           input.commitmentId,
      projection_title:        input.projectionTitle,
      projection_description:  input.projectionDescription,
      status:                  "generated",
      estimated_effort_hours:  input.estimatedEffortHours,
      estimated_duration_days: input.estimatedDurationDays,
      projected_risk:          input.projectedRisk,
      confidence_score:        input.confidenceScore,
      generated_at:            now,
    })
    .select(PROJ_COLS)
    .single<ExecutionProjectionRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindExecutionProjectionById(
  id: string,
  workspaceId: string
): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projections")
    .select(PROJ_COLS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single<ExecutionProjectionRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListExecutionProjections(
  input: ListProjectionsInput
): Promise<ExecutionProjectionResult<ExecutionProjectionRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("execution_projections")
    .select(PROJ_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.status)       query = query.eq("status", input.status);
  if (input.risk)         query = query.eq("projected_risk", input.risk);
  if (input.commitmentId) query = query.eq("commitment_id", input.commitmentId);
  if (input.fromDate)     query = query.gte("created_at", input.fromDate);
  if (input.toDate)       query = query.lte("created_at", input.toDate);

  const { data, error } = await query.returns<ExecutionProjectionRow[]>();
  if (error) return persistFailed("list");
  return { ok: true, data: data ?? [] };
}

export async function dbUpdateExecutionProjection(
  id: string,
  workspaceId: string,
  updates: Partial<{
    status: ExecutionProjectionStatus;
    validated_at: string | null;
    approved_at: string | null;
    archived_at: string | null;
  }>
): Promise<ExecutionProjectionResult<ExecutionProjectionRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projections")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(PROJ_COLS)
    .single<ExecutionProjectionRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function dbCreateExecutionProjectionTask(input: {
  workspaceId: string;
  projectionId: string;
  taskName: string;
  taskDescription: string;
  estimatedHours: number;
  sequenceOrder: number;
  ownerType: string;
}): Promise<ExecutionProjectionResult<ExecutionProjectionTaskRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projection_tasks")
    .insert({
      workspace_id:     input.workspaceId,
      projection_id:    input.projectionId,
      task_name:        input.taskName,
      task_description: input.taskDescription,
      estimated_hours:  input.estimatedHours,
      sequence_order:   input.sequenceOrder,
      owner_type:       input.ownerType,
    })
    .select(TASK_COLS)
    .single<ExecutionProjectionTaskRow>();
  if (error || !data) return persistFailed("create task");
  return { ok: true, data };
}

export async function dbListExecutionProjectionTasks(
  projectionId: string,
  workspaceId: string
): Promise<ExecutionProjectionResult<ExecutionProjectionTaskRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projection_tasks")
    .select(TASK_COLS)
    .eq("projection_id", projectionId)
    .eq("workspace_id", workspaceId)
    .order("sequence_order", { ascending: true })
    .returns<ExecutionProjectionTaskRow[]>();
  if (error) return persistFailed("list tasks");
  return { ok: true, data: data ?? [] };
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

export async function dbCreateExecutionProjectionDependency(input: {
  workspaceId: string;
  projectionId: string;
  dependencyType: string;
  dependencyReference: string;
  criticality: string;
}): Promise<ExecutionProjectionResult<ExecutionProjectionDependencyRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projection_dependencies")
    .insert({
      workspace_id:         input.workspaceId,
      projection_id:        input.projectionId,
      dependency_type:      input.dependencyType,
      dependency_reference: input.dependencyReference,
      criticality:          input.criticality,
    })
    .select(DEP_COLS)
    .single<ExecutionProjectionDependencyRow>();
  if (error || !data) return persistFailed("create dependency");
  return { ok: true, data };
}

export async function dbListExecutionProjectionDependencies(
  projectionId: string,
  workspaceId: string
): Promise<ExecutionProjectionResult<ExecutionProjectionDependencyRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projection_dependencies")
    .select(DEP_COLS)
    .eq("projection_id", projectionId)
    .eq("workspace_id", workspaceId)
    .returns<ExecutionProjectionDependencyRow[]>();
  if (error) return persistFailed("list dependencies");
  return { ok: true, data: data ?? [] };
}

// ─── Participants ─────────────────────────────────────────────────────────────

export async function dbCreateExecutionProjectionParticipant(input: {
  workspaceId: string;
  projectionId: string;
  participantType: string;
  participantReference: string;
  responsibility: string;
}): Promise<ExecutionProjectionResult<ExecutionProjectionParticipantRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projection_participants")
    .insert({
      workspace_id:          input.workspaceId,
      projection_id:         input.projectionId,
      participant_type:      input.participantType,
      participant_reference: input.participantReference,
      responsibility:        input.responsibility,
    })
    .select(PART_COLS)
    .single<ExecutionProjectionParticipantRow>();
  if (error || !data) return persistFailed("create participant");
  return { ok: true, data };
}

export async function dbListExecutionProjectionParticipants(
  projectionId: string,
  workspaceId: string
): Promise<ExecutionProjectionResult<ExecutionProjectionParticipantRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("execution_projection_participants")
    .select(PART_COLS)
    .eq("projection_id", projectionId)
    .eq("workspace_id", workspaceId)
    .returns<ExecutionProjectionParticipantRow[]>();
  if (error) return persistFailed("list participants");
  return { ok: true, data: data ?? [] };
}
