import { PLATFORM_EVENT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlatformEventFilters, PlatformEventListResult, PlatformEventRow } from "./types";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const PLATFORM_EVENT_COLUMNS = PLATFORM_EVENT_SELECTABLE_COLUMNS.join(",");

export async function getPlatformEvents(
  filters: PlatformEventFilters
): Promise<PlatformEventListResult> {
  if (!filters.workspaceId?.trim()) {
    return { ok: false, error: "workspaceId is required.", failureClass: "validation_failed" };
  }

  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = filters.offset ?? 0;

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("platform_events")
    .select(PLATFORM_EVENT_COLUMNS)
    .eq("workspace_id", filters.workspaceId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.eventCategory) query = query.eq("event_category", filters.eventCategory);
  if (filters.correlationId) query = query.eq("correlation_id", filters.correlationId);
  if (filters.fromDate) query = query.gte("occurred_at", filters.fromDate);
  if (filters.toDate) query = query.lte("occurred_at", filters.toDate);

  const { data, error } = await query.returns<PlatformEventRow[]>();

  if (error) {
    console.error("platform_events.query.failed", {
      workspaceId: filters.workspaceId,
      error: error.message,
    });
    return {
      ok: false,
      error: "Unable to retrieve governance events.",
      failureClass: "persistence_failed",
    };
  }

  return { ok: true, events: data ?? [] };
}
