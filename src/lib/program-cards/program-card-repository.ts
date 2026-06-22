import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_CARD_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramCardRow, ProgramCardResult } from "./types";

const COLUMNS = PROGRAM_CARD_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramCardResult<T> {
  return { ok: false, error: "Card not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramCardResult<T> {
  return { ok: false, error: `Unable to ${action} card.`, failureClass: "persistence_failed" };
}

export async function dbCreateProgramCard(input: {
  workspaceId: string;
  programId: string;
  epicId: string | null;
  sprintId: string | null;
  title: string;
  description: string | null;
  promptBody: string | null;
  type: string;
  status: string;
  orderIndex: number;
  materializationSource?: string | null;
  materializationType?: string | null;
  sourceLineNumber?: number | null;
  materializationId?: string | null;
  boardColumn?: string;
}): Promise<ProgramCardResult<ProgramCardRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .insert({
      workspace_id: input.workspaceId,
      program_id: input.programId,
      epic_id: input.epicId,
      sprint_id: input.sprintId,
      title: input.title,
      description: input.description,
      prompt_body: input.promptBody,
      type: input.type,
      status: input.status,
      order_index: input.orderIndex,
      materialization_source: input.materializationSource ?? null,
      materialization_type: input.materializationType ?? null,
      source_line_number: input.sourceLineNumber ?? null,
      materialization_id: input.materializationId ?? null,
      board_column: input.boardColumn ?? "BACKLOG",
    })
    .select(COLUMNS)
    .single<ProgramCardRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbUpdateProgramCard(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<ProgramCardResult<ProgramCardRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramCardRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbFindProgramCardById(
  id: string,
  workspaceId: string
): Promise<ProgramCardResult<ProgramCardRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramCardRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListProgramCards(
  programId: string,
  workspaceId: string
): Promise<ProgramCardResult<ProgramCardRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramCardRow[] };
}

export async function dbArchiveProgramCard(
  id: string,
  workspaceId: string
): Promise<ProgramCardResult<ProgramCardRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .update({ deleted_at: new Date().toISOString(), status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramCardRow>();
  if (error || !data) return { ok: false, error: "Card not found.", failureClass: "not_found" };
  return { ok: true, data };
}
