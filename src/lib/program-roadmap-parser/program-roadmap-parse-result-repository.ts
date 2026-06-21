import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_ROADMAP_PARSE_RESULT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramRoadmapParseResultRow } from "./types";
import type { ProgramRoadmapParserResult } from "./types";

const COLUMNS = PROGRAM_ROADMAP_PARSE_RESULT_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramRoadmapParserResult<T> {
  return { ok: false, error: "Parse result not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramRoadmapParserResult<T> {
  return { ok: false, error: `Unable to ${action} parse result.`, failureClass: "persistence_failed" };
}

export async function dbCreateParseResult(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
  status: string;
  resultJson: Record<string, unknown>;
  errorCount: number;
  warningCount: number;
  epicCount: number;
  sprintCount: number;
  parsedAt: Date;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_parse_results")
    .insert({
      workspace_id: input.workspaceId,
      program_id: input.programId,
      source_id: input.sourceId,
      status: input.status,
      result_json: input.resultJson,
      error_count: input.errorCount,
      warning_count: input.warningCount,
      epic_count: input.epicCount,
      sprint_count: input.sprintCount,
      parsed_at: input.parsedAt.toISOString(),
    })
    .select(COLUMNS)
    .single<ProgramRoadmapParseResultRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindParseResultById(
  id: string,
  workspaceId: string
): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_parse_results")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramRoadmapParseResultRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListParseResults(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_parse_results")
    .select(COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("program_id", input.programId)
    .eq("source_id", input.sourceId)
    .is("deleted_at", null)
    .order("parsed_at", { ascending: false });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramRoadmapParseResultRow[] };
}

export async function dbGetLatestParseResult(input: {
  workspaceId: string;
  programId: string;
  sourceId: string;
}): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_parse_results")
    .select(COLUMNS)
    .eq("workspace_id", input.workspaceId)
    .eq("program_id", input.programId)
    .eq("source_id", input.sourceId)
    .is("deleted_at", null)
    .order("parsed_at", { ascending: false })
    .limit(1)
    .maybeSingle<ProgramRoadmapParseResultRow>();
  if (error) return persistFailed("get latest");
  return { ok: true, data: data ?? null };
}

export async function dbArchiveParseResult(
  id: string,
  workspaceId: string
): Promise<ProgramRoadmapParserResult<ProgramRoadmapParseResultRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("program_roadmap_parse_results")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramRoadmapParseResultRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}
