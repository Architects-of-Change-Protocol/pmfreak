import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_MATERIALIZATION_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramMaterializationRow, ProgramMaterializationResult } from "./types";

const COLUMNS = PROGRAM_MATERIALIZATION_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramMaterializationResult<T> {
  return { ok: false, error: "Materialization not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramMaterializationResult<T> {
  return { ok: false, error: `Unable to ${action} materialization.`, failureClass: "persistence_failed" };
}

export async function dbCreateProgramMaterialization(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
  parseResultId: string;
}): Promise<ProgramMaterializationResult<ProgramMaterializationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_materializations")
    .insert({
      workspace_id: input.workspaceId,
      program_id: input.programId,
      source_id: input.sourceId,
      parse_result_id: input.parseResultId,
      status: "RUNNING",
      epics_created: 0,
      sprints_created: 0,
      cards_created: 0,
      started_at: new Date().toISOString(),
    })
    .select(COLUMNS)
    .single<ProgramMaterializationRow>();
  if (error || !data) {
    if (error?.code === "23505") {
      return {
        ok: false,
        error: "A materialization already exists for this program and parse result.",
        failureClass: "MATERIALIZATION_ALREADY_EXISTS",
      };
    }
    return persistFailed("create");
  }
  return { ok: true, data };
}

export async function dbFindActiveMaterialization(
  programId: string,
  parseResultId: string,
  workspaceId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_materializations")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("parse_result_id", parseResultId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle<ProgramMaterializationRow>();
  if (error) return persistFailed("find");
  return { ok: true, data: data ?? null };
}

export async function dbUpdateProgramMaterialization(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<ProgramMaterializationResult<ProgramMaterializationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_materializations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramMaterializationRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbFindProgramMaterializationById(
  id: string,
  workspaceId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_materializations")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramMaterializationRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListProgramMaterializations(
  programId: string,
  workspaceId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_materializations")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramMaterializationRow[] };
}

export async function dbArchiveProgramMaterialization(
  id: string,
  workspaceId: string
): Promise<ProgramMaterializationResult<ProgramMaterializationRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("program_materializations")
    .update({ deleted_at: now, status: "ARCHIVED", updated_at: now })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramMaterializationRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}
