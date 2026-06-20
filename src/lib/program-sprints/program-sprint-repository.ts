import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_SPRINT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramSprintRow, ProgramSprintResult } from "./types";

const COLUMNS = PROGRAM_SPRINT_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramSprintResult<T> {
  return { ok: false, error: "Sprint not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramSprintResult<T> {
  return { ok: false, error: `Unable to ${action} sprint.`, failureClass: "persistence_failed" };
}

export async function dbCreateProgramSprint(input: {
  workspaceId: string;
  programId: string;
  epicId: string;
  number: number;
  title: string;
  description: string | null;
  objective: string | null;
  status: string;
  orderIndex: number;
}): Promise<ProgramSprintResult<ProgramSprintRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_sprints")
    .insert({
      workspace_id: input.workspaceId,
      program_id: input.programId,
      epic_id: input.epicId,
      number: input.number,
      title: input.title,
      description: input.description,
      objective: input.objective,
      status: input.status,
      order_index: input.orderIndex,
    })
    .select(COLUMNS)
    .single<ProgramSprintRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbUpdateProgramSprint(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_sprints")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramSprintRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbFindProgramSprintById(
  id: string,
  workspaceId: string
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_sprints")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramSprintRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListProgramSprints(
  epicId: string,
  workspaceId: string
): Promise<ProgramSprintResult<ProgramSprintRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_sprints")
    .select(COLUMNS)
    .eq("epic_id", epicId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramSprintRow[] };
}

export async function dbArchiveProgramSprint(
  id: string,
  workspaceId: string
): Promise<ProgramSprintResult<ProgramSprintRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_sprints")
    .update({ deleted_at: new Date().toISOString(), status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramSprintRow>();
  if (error || !data) return { ok: false, error: "Sprint not found.", failureClass: "not_found" };
  return { ok: true, data };
}
