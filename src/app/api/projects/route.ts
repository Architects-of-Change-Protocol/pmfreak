import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createMinimalProject } from "@/lib/projects/create-minimal-project";

export async function GET() {
  try {
    const { user } = await requireAuthenticatedUser();
    const supabase = await createSupabaseServerClient();
    const resolution = await resolvePreferredWorkspace(user.id);
    const workspaceId = resolution.workspaceId;

    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: "/api/projects", message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id, eventType: "workspace_scope_violation" });
    }

    await requireWorkspaceMember(workspaceId);

    const { data: projects } = await supabase.from("projects").select("id,name,pmo_id,status").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    return NextResponse.json({ projects: projects ?? [] });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: "/api/projects", message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: "/api/projects", message: "Forbidden" });
    }
    throw error;
  }
}

const CREATE_FAILURE_STATUS: Record<string, number> = {
  validation_failed: 400,
  upgrade_required: 402,
  persistence_failed: 500,
};

/**
 * Minimal project creation for the create-project modal — writes through
 * the same createMinimalProject() service used by the /projects inline
 * form's server action. Tenancy is enforced by construction:
 * resolveWriteWorkspace(userId) only ever resolves to a workspace the
 * authenticated caller actually belongs to.
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    ({ user } = await requireAuthenticatedUser());
  } catch {
    return denyResponse({ status: 401, routeId: "/api/projects", message: "Unauthorized", reason: "unauthorized" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON.", failureClass: "validation_failed" }, { status: 400 });
  }

  const result = await createMinimalProject({ ...(body as object), userId: user.id });

  if (!result.ok) {
    const status = CREATE_FAILURE_STATUS[result.failureClass] ?? 500;
    return NextResponse.json(
      { ok: false, error: result.error, failureClass: result.failureClass, fieldErrors: result.fieldErrors },
      { status },
    );
  }

  return NextResponse.json({ ok: true, data: { project: result.project } }, { status: 201 });
}
