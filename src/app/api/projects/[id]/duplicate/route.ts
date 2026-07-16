import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";
import { duplicateProject } from "@/lib/projects/project-admin-service";

const ROUTE_ID = "/api/projects/[id]/duplicate";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const projectId = id.trim();
  if (!projectId) return Response.json({ error: "projectId is required." }, { status: 400 });

  try {
    const { user } = await requireAuthenticatedUser();
    await requireProjectAccess(projectId, "write");

    const supabase = await createSupabaseServerClient();
    const { data: scoped } = await supabase
      .from("projects")
      .select("id, workspace_id")
      .eq("id", projectId)
      .maybeSingle<{ id: string; workspace_id: string }>();
    if (!scoped) return Response.json({ error: "Project not found." }, { status: 404 });

    const project = await duplicateProject(scoped.workspace_id, projectId, user.id);
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Invalid project context.", projectId, requestedPermission: "write", deniedPermission: "write", eventType: "project_scope_violation" });
    }
    return safeLegacyErrorResponse(ROUTE_ID, error, "Unable to duplicate project.");
  }
}
