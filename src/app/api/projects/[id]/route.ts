import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";
import {
  deleteProject,
  normalizeProjectMethodology,
  normalizeProjectStatus,
  updateProject,
  type UpdateProjectInput,
} from "@/lib/projects/project-admin-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  let userId: string | null = null;
  const { id } = await params;
  const projectId = id.trim();

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
        return denyResponse({ status: 401, routeId: "/api/projects/[id]", message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: "/api/projects/[id]", message: "Invalid project context.", actorUserId: userId, projectId, requestedPermission: "read", deniedPermission: "read", eventType: "project_scope_violation" });
    }
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();

  if (!project) {
    return denyResponse({ status: 404, routeId: "/api/projects/[id]", message: "Project not found.", reason: "project_not_found_or_out_of_scope", actorUserId: userId, projectId, requestedPermission: "read", deniedPermission: "read", eventType: "project_scope_violation" });
  }

  return Response.json(project);
}

async function authorizeWrite(projectIdRaw: string) {
  const projectId = projectIdRaw.trim();
  if (!projectId) {
    return { error: Response.json({ error: "projectId is required." }, { status: 400 }) } as const;
  }
  try {
    const { user } = await requireAuthenticatedUser();
    await requireProjectAccess(projectId, "write");
    return { user, projectId } as const;
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return { error: denyResponse({ status: 401, routeId: "/api/projects/[id]", message: "Unauthorized", reason: "unauthorized" }) } as const;
      }
      return {
        error: denyFromAccessError(error, { status: 403, routeId: "/api/projects/[id]", message: "Invalid project context.", projectId, requestedPermission: "write", deniedPermission: "write", eventType: "project_scope_violation" }),
      } as const;
    }
    throw error;
  }
}

async function loadScopedProject(projectId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  return data ?? null;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const authorized = await authorizeWrite(id);
  if ("error" in authorized) return authorized.error;

  const scoped = await loadScopedProject(authorized.projectId);
  if (!scoped) return Response.json({ error: "Project not found." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: UpdateProjectInput = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "Project name cannot be empty." }, { status: 400 });
    patch.name = name;
  }
  if (body.description !== undefined) {
    patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if (body.status !== undefined) {
    const status = normalizeProjectStatus(body.status);
    if (!status) return Response.json({ error: "Invalid project status." }, { status: 400 });
    patch.status = status;
  }
  if (body.methodology !== undefined) {
    if (body.methodology === null) {
      patch.methodology = null;
    } else {
      const methodology = normalizeProjectMethodology(body.methodology);
      if (!methodology) return Response.json({ error: "Invalid methodology." }, { status: 400 });
      patch.methodology = methodology;
    }
  }
  if (body.icon !== undefined) patch.icon = typeof body.icon === "string" && body.icon.trim() ? body.icon.trim() : null;
  if (body.color !== undefined) patch.color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
  if (body.pmoId !== undefined) {
    if (body.pmoId !== null && typeof body.pmoId !== "string") {
      return Response.json({ error: "Invalid pmoId." }, { status: 400 });
    }
    patch.pmoId = body.pmoId as string | null;
  }
  if (body.ownerUserId !== undefined) {
    if (typeof body.ownerUserId !== "string" || !body.ownerUserId.trim()) {
      return Response.json({ error: "Invalid ownerUserId." }, { status: 400 });
    }
    patch.ownerUserId = body.ownerUserId.trim();
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No valid fields to update." }, { status: 400 });
  }

  try {
    const project = await updateProject(scoped.workspace_id, authorized.projectId, patch);
    return Response.json({ project });
  } catch (error) {
    return safeLegacyErrorResponse("/api/projects/[id]", error, "Unable to update project.");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const authorized = await authorizeWrite(id);
  if ("error" in authorized) return authorized.error;

  const scoped = await loadScopedProject(authorized.projectId);
  if (!scoped) return Response.json({ error: "Project not found." }, { status: 404 });

  try {
    await deleteProject(scoped.workspace_id, authorized.projectId);
    return Response.json({ deleted: true });
  } catch (error) {
    return safeLegacyErrorResponse("/api/projects/[id]", error, "Unable to delete project.");
  }
}
