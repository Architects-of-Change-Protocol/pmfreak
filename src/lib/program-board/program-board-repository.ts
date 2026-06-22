import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_CARD_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramBoardColumn, ProgramCardRow } from "@/lib/db/database-contract";
import type { ProgramBoardResult } from "./types";

const COLUMNS = PROGRAM_CARD_SELECTABLE_COLUMNS.join(",");

function persistFailed<T>(action: string): ProgramBoardResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

export async function dbGetProgramCards(
  programId: string,
  workspaceId: string
): Promise<ProgramBoardResult<ProgramCardRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) return persistFailed("list program cards");
  return { ok: true, data: (data ?? []) as unknown as ProgramCardRow[] };
}

export async function dbGetProgramCardById(
  cardId: string,
  workspaceId: string
): Promise<ProgramBoardResult<ProgramCardRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .select(COLUMNS)
    .eq("id", cardId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramCardRow>();
  if (error || !data) return { ok: false, error: "Card not found.", failureClass: "not_found" };
  return { ok: true, data };
}

export async function dbUpdateBoardColumn(
  cardId: string,
  workspaceId: string,
  boardColumn: ProgramBoardColumn
): Promise<ProgramBoardResult<ProgramCardRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_cards")
    .update({ board_column: boardColumn, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramCardRow>();
  if (error || !data) return persistFailed("update board column");
  return { ok: true, data };
}
