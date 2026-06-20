import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramRow } from "./types";
import type { ProgramResult } from "./types";

const COLUMNS = PROGRAM_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramResult<T> {
  return { ok: false, error: "Program not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramResult<T> {
  return { ok: false, error: `Unable to ${action} program.`, failureClass: "persistence_failed" };
}

export async function dbCreateProgram(input: {
  workspaceId: string;
  name: string;
  description: string | null;
  type: string;
  ownerId: string;
}): Promise<ProgramResult<ProgramRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      status: "DRAFT",
      owner_id: input.ownerId,
    })
    .select(COLUMNS)
    .single<ProgramRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbUpdateProgram(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<ProgramResult<ProgramRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbFindProgramById(
  id: string,
  workspaceId: string
): Promise<ProgramResult<ProgramRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListPrograms(
  workspaceId: string
): Promise<ProgramResult<ProgramRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .select(COLUMNS)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramRow[] };
}

export async function dbArchiveProgram(
  id: string,
  workspaceId: string
): Promise<ProgramResult<ProgramRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("programs")
    .update({ deleted_at: new Date().toISOString(), status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramRow>();
  if (error || !data) return { ok: false, error: "Program not found.", failureClass: "not_found" };
  return { ok: true, data };
}
