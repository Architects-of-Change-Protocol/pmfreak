import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  OPERATIONAL_COMMAND_CENTER_SELECTABLE_COLUMNS,
  OPERATIONAL_FOCUS_ITEM_SELECTABLE_COLUMNS,
  OPERATIONAL_FOCUS_LINK_SELECTABLE_COLUMNS,
} from "@/lib/db/database-contract";
import type {
  OperationalCommandCenterRow,
  OperationalFocusItemRow,
  OperationalFocusLinkRow,
  OperationalCommandStatus,
  OperationalFocusStatus,
} from "@/lib/db/database-contract";
import type {
  CommandCenterResult,
  ListCommandCentersInput,
  GeneratedFocusItem,
} from "./types";

const CC_COLS  = OPERATIONAL_COMMAND_CENTER_SELECTABLE_COLUMNS.join(",");
const FI_COLS  = OPERATIONAL_FOCUS_ITEM_SELECTABLE_COLUMNS.join(",");
const FL_COLS  = OPERATIONAL_FOCUS_LINK_SELECTABLE_COLUMNS.join(",");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function notFound<T>(entity: string): CommandCenterResult<T> {
  return { ok: false, error: `${entity} not found.`, failureClass: "not_found" };
}

function persistFailed<T>(action: string): CommandCenterResult<T> {
  return { ok: false, error: `Unable to ${action}.`, failureClass: "persistence_failed" };
}

// ─── Command Centers ──────────────────────────────────────────────────────────

export async function dbCreateCommandCenter(input: {
  workspaceId: string;
  projectId: string;
  snapshotId: string;
  overallPriority: string;
  focusScore: number;
}): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_command_centers")
    .insert({
      workspace_id:     input.workspaceId,
      project_id:       input.projectId,
      snapshot_id:      input.snapshotId,
      command_status:   "generated",
      overall_priority: input.overallPriority,
      focus_score:      input.focusScore,
      generated_at:     new Date().toISOString(),
    })
    .select(CC_COLS)
    .single<OperationalCommandCenterRow>();
  if (error || !data) return persistFailed("create command center");
  return { ok: true, data };
}

export async function dbFindCommandCenterById(
  commandCenterId: string,
  workspaceId: string
): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_command_centers")
    .select(CC_COLS)
    .eq("id", commandCenterId)
    .eq("workspace_id", workspaceId)
    .single<OperationalCommandCenterRow>();
  if (error || !data) return notFound("Command center");
  return { ok: true, data };
}

export async function dbListCommandCenters(
  input: ListCommandCentersInput
): Promise<CommandCenterResult<OperationalCommandCenterRow[]>> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("operational_command_centers")
    .select(CC_COLS)
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  if (input.projectId)  query = query.eq("project_id", input.projectId);
  if (input.snapshotId) query = query.eq("snapshot_id", input.snapshotId);
  if (input.status)     query = query.eq("command_status", input.status);
  if (input.priority)   query = query.eq("overall_priority", input.priority);
  if (input.fromDate)   query = query.gte("created_at", input.fromDate);
  if (input.toDate)     query = query.lte("created_at", input.toDate);
  if (input.limit)      query = query.limit(input.limit);

  const { data, error } = await query.returns<OperationalCommandCenterRow[]>();
  if (error) return persistFailed("list command centers");
  return { ok: true, data: data ?? [] };
}

export async function dbUpdateCommandCenterStatus(
  commandCenterId: string,
  workspaceId: string,
  status: OperationalCommandStatus
): Promise<CommandCenterResult<OperationalCommandCenterRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_command_centers")
    .update({ command_status: status, updated_at: new Date().toISOString() })
    .eq("id", commandCenterId)
    .eq("workspace_id", workspaceId)
    .select(CC_COLS)
    .single<OperationalCommandCenterRow>();
  if (error || !data) return persistFailed("update command center status");
  return { ok: true, data };
}

// ─── Focus Items ──────────────────────────────────────────────────────────────

export async function dbCreateFocusItem(input: {
  workspaceId: string;
  commandCenterId: string;
  item: GeneratedFocusItem;
}): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_focus_items")
    .insert({
      workspace_id:               input.workspaceId,
      command_center_id:          input.commandCenterId,
      attention_item_id:          input.item.attentionItemId,
      focus_type:                 input.item.focusType,
      priority:                   input.item.priority,
      focus_score:                input.item.focusScore,
      title:                      input.item.title,
      description:                input.item.description,
      rationale:                  input.item.rationale,
      recommended_action_type:    input.item.recommendedActionType,
      recommended_owner_type:     input.item.recommendedOwnerType,
      recommended_due_date:       input.item.recommendedDueDate,
      status:                     "open",
    })
    .select(FI_COLS)
    .single<OperationalFocusItemRow>();
  if (error || !data) return persistFailed("create focus item");
  return { ok: true, data };
}

export async function dbFindFocusItemById(
  focusItemId: string,
  workspaceId: string
): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_focus_items")
    .select(FI_COLS)
    .eq("id", focusItemId)
    .eq("workspace_id", workspaceId)
    .single<OperationalFocusItemRow>();
  if (error || !data) return notFound("Focus item");
  return { ok: true, data };
}

export async function dbListFocusItemsByCommandCenter(
  commandCenterId: string,
  workspaceId: string
): Promise<CommandCenterResult<OperationalFocusItemRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_focus_items")
    .select(FI_COLS)
    .eq("command_center_id", commandCenterId)
    .eq("workspace_id", workspaceId)
    .order("focus_score", { ascending: false })
    .returns<OperationalFocusItemRow[]>();
  if (error) return persistFailed("list focus items");
  return { ok: true, data: data ?? [] };
}

export async function dbUpdateFocusItemStatus(
  focusItemId: string,
  workspaceId: string,
  status: OperationalFocusStatus,
  timestamps?: { resolved_at?: string; dismissed_at?: string }
): Promise<CommandCenterResult<OperationalFocusItemRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_focus_items")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(timestamps ?? {}),
    })
    .eq("id", focusItemId)
    .eq("workspace_id", workspaceId)
    .select(FI_COLS)
    .single<OperationalFocusItemRow>();
  if (error || !data) return persistFailed("update focus item status");
  return { ok: true, data };
}

// ─── Focus Links ──────────────────────────────────────────────────────────────

export async function dbCreateFocusLink(input: {
  workspaceId: string;
  focusItemId: string;
  entityType: string;
  entityId: string;
  relationshipType: string;
}): Promise<CommandCenterResult<OperationalFocusLinkRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_focus_links")
    .insert({
      workspace_id:      input.workspaceId,
      focus_item_id:     input.focusItemId,
      entity_type:       input.entityType,
      entity_id:         input.entityId,
      relationship_type: input.relationshipType,
    })
    .select(FL_COLS)
    .single<OperationalFocusLinkRow>();
  if (error || !data) return persistFailed("create focus link");
  return { ok: true, data };
}

export async function dbListFocusLinksByFocusItem(
  focusItemId: string,
  workspaceId: string
): Promise<CommandCenterResult<OperationalFocusLinkRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_focus_links")
    .select(FL_COLS)
    .eq("focus_item_id", focusItemId)
    .eq("workspace_id", workspaceId)
    .returns<OperationalFocusLinkRow[]>();
  if (error) return persistFailed("list focus links");
  return { ok: true, data: data ?? [] };
}
