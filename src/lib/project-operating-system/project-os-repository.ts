import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  PROJECT_OS_SNAPSHOT_SELECTABLE_COLUMNS,
  PROJECT_OS_ATTENTION_ITEM_SELECTABLE_COLUMNS,
  PROJECT_OS_CONTEXT_LINK_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  ProjectOSSnapshotRow,
  ProjectOSAttentionItemRow,
  ProjectOSContextLinkRow,
  ProjectOSSnapshotStatus,
} from "@/lib/db/database-contract";
import type {
  ProjectOSResult,
  ProjectOSSnapshotPayload,
  ProjectOSHealthScore,
  ListProjectOSSnapshotsInput,
  DetectedAttentionItem,
} from "./types";

const SNAPSHOT_COLS = PROJECT_OS_SNAPSHOT_SELECTABLE_COLUMNS.join(",");
const ATTENTION_COLS = PROJECT_OS_ATTENTION_ITEM_SELECTABLE_COLUMNS.join(",");
const CONTEXT_LINK_COLS = PROJECT_OS_CONTEXT_LINK_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound<T>(): ProjectOSResult<T> {
  return { ok: false, error: "Project OS snapshot not found.", failureClass: "not_found" };
}
function persistFailed<T>(action: string): ProjectOSResult<T> {
  return { ok: false, error: `Unable to ${action} snapshot.`, failureClass: "persistence_failed" };
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export async function dbCreateProjectOSSnapshot(input: {
  workspaceId: string;
  projectId: string;
  health: ProjectOSHealthScore;
  payload: ProjectOSSnapshotPayload;
}): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_snapshots")
    .insert({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      snapshot_status: "generated",
      operating_health_score: input.health.operatingHealthScore,
      governance_health_score: input.health.governanceHealthScore,
      execution_health_score: input.health.executionHealthScore,
      memory_health_score: input.health.memoryHealthScore,
      recommendation_health_score: input.health.recommendationHealthScore,
      snapshot_payload: input.payload as unknown as Record<string, unknown>,
      generated_at: new Date().toISOString(),
    })
    .select(SNAPSHOT_COLS)
    .single<ProjectOSSnapshotRow>();
  if (error || !data) return persistFailed("create");
  return { ok: true, data };
}

export async function dbFindProjectOSSnapshotById(
  snapshotId: string,
  workspaceId: string
): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("id", snapshotId)
    .eq("workspace_id", workspaceId)
    .single<ProjectOSSnapshotRow>();
  if (error || !data) return notFound();
  return { ok: true, data };
}

export async function dbListProjectOSSnapshots(
  input: ListProjectOSSnapshotsInput
): Promise<ProjectOSResult<ProjectOSSnapshotRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("project_os_snapshots")
    .select(SNAPSHOT_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.projectId)    query = query.eq("project_id", input.projectId);
  if (input.status)       query = query.eq("snapshot_status", input.status);
  if (input.fromDate)     query = query.gte("created_at", input.fromDate);
  if (input.toDate)       query = query.lte("created_at", input.toDate);
  if (input.minHealthScore !== undefined) {
    query = query.gte("operating_health_score", input.minHealthScore);
  }
  if (input.maxHealthScore !== undefined) {
    query = query.lte("operating_health_score", input.maxHealthScore);
  }
  if (input.limit) query = query.limit(input.limit);

  const { data, error } = await query.returns<ProjectOSSnapshotRow[]>();
  if (error) return persistFailed("list");
  return { ok: true, data: data ?? [] };
}

export async function dbUpdateProjectOSSnapshotStatus(
  snapshotId: string,
  workspaceId: string,
  status: ProjectOSSnapshotStatus
): Promise<ProjectOSResult<ProjectOSSnapshotRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_snapshots")
    .update({ snapshot_status: status })
    .eq("id", snapshotId)
    .eq("workspace_id", workspaceId)
    .select(SNAPSHOT_COLS)
    .single<ProjectOSSnapshotRow>();
  if (error || !data) return persistFailed("update");
  return { ok: true, data };
}

// ─── Attention Items ──────────────────────────────────────────────────────────

export async function dbCreateProjectOSAttentionItem(input: {
  workspaceId: string;
  snapshotId: string;
  item: DetectedAttentionItem;
}): Promise<ProjectOSResult<ProjectOSAttentionItemRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_attention_items")
    .insert({
      workspace_id: input.workspaceId,
      snapshot_id: input.snapshotId,
      attention_type: input.item.attentionType,
      attention_severity: input.item.attentionSeverity,
      source_entity_type: input.item.sourceEntityType,
      source_entity_id: input.item.sourceEntityId,
      title: input.item.title,
      description: input.item.description,
      recommended_action: input.item.recommendedAction ?? null,
    })
    .select(ATTENTION_COLS)
    .single<ProjectOSAttentionItemRow>();
  if (error || !data) return persistFailed("create attention item");
  return { ok: true, data };
}

export async function dbListProjectOSAttentionItems(
  snapshotId: string,
  workspaceId: string
): Promise<ProjectOSResult<ProjectOSAttentionItemRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_attention_items")
    .select(ATTENTION_COLS)
    .eq("snapshot_id", snapshotId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .returns<ProjectOSAttentionItemRow[]>();
  if (error) return persistFailed("list attention items");
  return { ok: true, data: data ?? [] };
}

// ─── Context Links ────────────────────────────────────────────────────────────

export async function dbCreateProjectOSContextLink(input: {
  workspaceId: string;
  snapshotId: string;
  entityType: string;
  entityId: string;
  relationshipType: string;
}): Promise<ProjectOSResult<ProjectOSContextLinkRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_context_links")
    .insert({
      workspace_id: input.workspaceId,
      snapshot_id: input.snapshotId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      relationship_type: input.relationshipType,
    })
    .select(CONTEXT_LINK_COLS)
    .single<ProjectOSContextLinkRow>();
  if (error || !data) return persistFailed("create context link");
  return { ok: true, data };
}

export async function dbListProjectOSContextLinks(
  snapshotId: string,
  workspaceId: string
): Promise<ProjectOSResult<ProjectOSContextLinkRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("project_os_context_links")
    .select(CONTEXT_LINK_COLS)
    .eq("snapshot_id", snapshotId)
    .eq("workspace_id", workspaceId)
    .returns<ProjectOSContextLinkRow[]>();
  if (error) return persistFailed("list context links");
  return { ok: true, data: data ?? [] };
}
