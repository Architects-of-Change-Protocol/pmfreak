import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";

const normalizeParam = (request: Request, key: string) =>
  new URL(request.url).searchParams.get(key)?.trim() ?? "";

export async function GET(request: Request) {
  let userId: string | null = null;
  const projectId = normalizeParam(request, "projectId");
  const raidItemId = normalizeParam(request, "raidItemId");
  const status = normalizeParam(request, "status");

  if (!projectId) {
    return Response.json({ error: "projectId is required." }, { status: 400 });
  }

  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: "/api/recommended-actions", message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: "/api/recommended-actions",
        message: "Invalid project context.",
        actorUserId: userId,
        projectId,
        requestedPermission: "read",
        deniedPermission: "read",
        eventType: "project_scope_violation",
      });
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("recommended_actions")
    .select("id,workspace_id,project_id,raid_item_id,title,description,recommended_action_type,status,confidence_score,impact_level,rationale,recommended_owner,recommended_due_window,evidence_summary,source_signal_id,fingerprint,decision_reason,decided_by,decided_at,deferred_until,converted_task_id,decision_metadata,created_at,updated_at")
    .eq("project_id", projectId)
    .is("governance_event_id", null)
    .order("confidence_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (raidItemId) {
    query = query.eq("raid_item_id", raidItemId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: "Unable to load recommended actions." }, { status: 500 });
  }

  return Response.json({ recommendedActions: data ?? [] });
}
