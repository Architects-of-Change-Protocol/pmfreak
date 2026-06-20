import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_EPIC_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramEpicRow, ProgramEpicResult } from "./types";

const COLUMNS = PROGRAM_EPIC_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramEpicResult<T> {
  return { ok: false, error: "Epic not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramEpicResult<T> {
  return { ok: false, error: `Unable to ${action} epic.`, failureClass: "persistence_failed" };
}

export async function dbCreateProgramEpic(input: {
  workspaceId: string;
  programId: string;
  number: number;
  title: string;
  description: string | null;
  status: string;
  orderIndex: number;
}): Promise<ProgramEpicResult<ProgramEpicRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_epics")
    .insert({
      workspace_id: input.workspaceId,
      program_id: input.programId,
      number: input.number,
      title: input.title,
      description: input.description,
      status: input.status,
      order_index: input.orderIndex,
    })
    .select(COLUMNS)
    .single<ProgramEpicRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbUpdateProgramEpic(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_epics")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramEpicRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbFindProgramEpicById(
  id: string,
  workspaceId: string
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_epics")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramEpicRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListProgramEpics(
  programId: string,
  workspaceId: string
): Promise<ProgramEpicResult<ProgramEpicRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_epics")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramEpicRow[] };
}

export async function dbArchiveProgramEpic(
  id: string,
  workspaceId: string
): Promise<ProgramEpicResult<ProgramEpicRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_epics")
    .update({ deleted_at: new Date().toISOString(), status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramEpicRow>();
  if (error || !data) return { ok: false, error: "Epic not found.", failureClass: "not_found" };
  return { ok: true, data };
}
