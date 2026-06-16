import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import type { TaskDraftRow } from "@/lib/db/database-contract";

const TASK_DRAFT_COLS =
  "id,workspace_id,project_id,recommended_action_id,raid_item_id,title,description,draft_status,suggested_owner,suggested_due_date,suggested_due_window,priority,source_type,source_payload,acceptance_criteria,checklist,confidence_score,created_by,created_at,updated_at";

const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId")?.trim() ?? "";
  const recommendedActionId = url.searchParams.get("recommendedActionId")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";

  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      const reason = String((error as Error & { metadata?: { reason?: string } }).metadata?.reason ?? "");
      if (reason === "unauthorized") {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
      }
      return Response.json({ error: "Access denied.", actorUserId: userId }, { status: 403 });
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("task_drafts")
    .select(TASK_DRAFT_COLS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (recommendedActionId) {
    query = query.eq("recommended_action_id", recommendedActionId);
  }
  if (status) {
    query = query.eq("draft_status", status);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: "Unable to load task drafts." }, { status: 500 });
  }

  const drafts = (data ?? []) as TaskDraftRow[];

  drafts.sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return Response.json({ drafts });
}
