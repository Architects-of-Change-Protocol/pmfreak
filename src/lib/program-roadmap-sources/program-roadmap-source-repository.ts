import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_ROADMAP_SOURCE_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramRoadmapSourceRow, ProgramRoadmapSourceResult } from "./types";

const COLUMNS = PROGRAM_ROADMAP_SOURCE_SELECTABLE_COLUMNS.join(",");

function notFound<T>(): ProgramRoadmapSourceResult<T> {
  return { ok: false, error: "Roadmap source not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProgramRoadmapSourceResult<T> {
  return { ok: false, error: `Unable to ${action} roadmap source.`, failureClass: "persistence_failed" };
}

export async function dbCreateProgramRoadmapSource(input: {
  workspaceId: string;
  programId: string;
  rawText: string;
  sourceType: string;
  title: string | null;
  version: number;
  status: string;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
}): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .insert({
      workspace_id: input.workspaceId,
      program_id: input.programId,
      raw_text: input.rawText,
      source_type: input.sourceType,
      title: input.title,
      version: input.version,
      status: input.status,
      metadata: input.metadata,
      created_by: input.createdBy,
    })
    .select(COLUMNS)
    .single<ProgramRoadmapSourceRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbUpdateProgramRoadmapSource(
  id: string,
  workspaceId: string,
  patch: Record<string, unknown>
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramRoadmapSourceRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

export async function dbFindProgramRoadmapSourceById(
  id: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .select(COLUMNS)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .single<ProgramRoadmapSourceRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListProgramRoadmapSources(
  programId: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return persistFailed("list");
  return { ok: true, data: (data ?? []) as unknown as ProgramRoadmapSourceRow[] };
}

export async function dbGetActiveProgramRoadmapSource(
  programId: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .select(COLUMNS)
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .maybeSingle<ProgramRoadmapSourceRow>();
  if (error) return persistFailed("get active");
  return { ok: true, data: data ?? null };
}

export async function dbSupersedeProgramRoadmapSources(
  programId: string,
  workspaceId: string,
  excludeId: string
): Promise<ProgramRoadmapSourceResult<void>> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("program_roadmap_sources")
    .update({ status: "SUPERSEDED", updated_at: new Date().toISOString() })
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .eq("status", "ACTIVE")
    .neq("id", excludeId)
    .is("deleted_at", null);
  if (error) return persistFailed("supersede");
  return { ok: true, data: undefined };
}

export async function dbGetNextVersionForProgram(
  programId: string,
  workspaceId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("program_roadmap_sources")
    .select("version")
    .eq("program_id", programId)
    .eq("workspace_id", workspaceId)
    .order("version", { ascending: false })
    .limit(1)
    .single<{ version: number }>();
  return (data?.version ?? 0) + 1;
}

export async function dbArchiveProgramRoadmapSource(
  id: string,
  workspaceId: string
): Promise<ProgramRoadmapSourceResult<ProgramRoadmapSourceRow>> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("program_roadmap_sources")
    .update({ deleted_at: now, status: "ARCHIVED", updated_at: now })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .select(COLUMNS)
    .single<ProgramRoadmapSourceRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}
