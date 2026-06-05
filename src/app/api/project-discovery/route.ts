import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";

const normalizeProjectId = (request: Request) => new URL(request.url).searchParams.get("projectId")?.trim() ?? "";

export async function GET(request: Request) {
  let userId: string | null = null;
  const projectId = normalizeProjectId(request);

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
        return denyResponse({ status: 401, routeId: "/api/project-discovery", message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, {
        status: 403,
        routeId: "/api/project-discovery",
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
  const { data, error } = await supabase
    .from("project_discovery")
    .select("id,project_id,workspace_id,version,stakeholders_json,dependencies_json,risks_json,milestones_json,deliverables_json,assumptions_json,unknowns_json,confidence_score,evidence_count,discovery_payload_hash,generated_at,created_at,updated_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "Unable to load project discovery." }, { status: 500 });
  }

  return Response.json({ discovery: data ?? null });
}
