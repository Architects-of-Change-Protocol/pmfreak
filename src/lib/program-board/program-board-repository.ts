import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROGRAM_CARD_SELECTABLE_COLUMNS,
  PROGRAM_EPIC_SELECTABLE_COLUMNS,
  PROGRAM_SPRINT_SELECTABLE_COLUMNS,
  PROGRAM_MATERIALIZATION_SELECTABLE_COLUMNS,
  PROGRAM_ROADMAP_SOURCE_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  ProgramBoardColumn,
  ProgramCardRow,
  ProgramEpicRow,
  ProgramSprintRow,
  ProgramMaterializationRow,
  ProgramRoadmapSourceRow,
} from "@/lib/db/database-contract";
import type { ProgramBoardResult } from "./types";

const COLUMNS = PROGRAM_CARD_SELECTABLE_COLUMNS.join(",");
const EPIC_COLUMNS = PROGRAM_EPIC_SELECTABLE_COLUMNS.join(",");
const SPRINT_COLUMNS = PROGRAM_SPRINT_SELECTABLE_COLUMNS.join(",");
const MAT_COLUMNS = PROGRAM_MATERIALIZATION_SELECTABLE_COLUMNS.join(",");
const SOURCE_COLUMNS = PROGRAM_ROADMAP_SOURCE_SELECTABLE_COLUMNS.join(",");

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

export async function dbGetProgramEpicsByIds(input: {
  workspaceId: string;
  programId: string;
  epicIds: string[];
}): Promise<ProgramBoardResult<ProgramEpicRow[]>> {
  if (input.epicIds.length === 0) return { ok: true, data: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_epics")
    .select(EPIC_COLUMNS)
    .in("id", input.epicIds)
    .eq("program_id", input.programId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);
  if (error) return persistFailed("list epics by ids");
  return { ok: true, data: (data ?? []) as unknown as ProgramEpicRow[] };
}

export async function dbGetProgramSprintsByIds(input: {
  workspaceId: string;
  programId: string;
  sprintIds: string[];
}): Promise<ProgramBoardResult<ProgramSprintRow[]>> {
  if (input.sprintIds.length === 0) return { ok: true, data: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_sprints")
    .select(SPRINT_COLUMNS)
    .in("id", input.sprintIds)
    .eq("program_id", input.programId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);
  if (error) return persistFailed("list sprints by ids");
  return { ok: true, data: (data ?? []) as unknown as ProgramSprintRow[] };
}

export async function dbGetProgramMaterializationsByIds(input: {
  workspaceId: string;
  programId: string;
  materializationIds: string[];
}): Promise<ProgramBoardResult<ProgramMaterializationRow[]>> {
  if (input.materializationIds.length === 0) return { ok: true, data: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_materializations")
    .select(MAT_COLUMNS)
    .in("id", input.materializationIds)
    .eq("program_id", input.programId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);
  if (error) return persistFailed("list materializations by ids");
  return { ok: true, data: (data ?? []) as unknown as ProgramMaterializationRow[] };
}

export async function dbGetProgramRoadmapSourcesByIds(input: {
  workspaceId: string;
  programId: string;
  sourceIds: string[];
}): Promise<ProgramBoardResult<ProgramRoadmapSourceRow[]>> {
  if (input.sourceIds.length === 0) return { ok: true, data: [] };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .select(SOURCE_COLUMNS)
    .in("id", input.sourceIds)
    .eq("program_id", input.programId)
    .eq("workspace_id", input.workspaceId)
    .is("deleted_at", null);
  if (error) return persistFailed("list roadmap sources by ids");
  return { ok: true, data: (data ?? []) as unknown as ProgramRoadmapSourceRow[] };
}
