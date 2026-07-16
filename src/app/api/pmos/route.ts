import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { requireWorkspaceRole as requireWorkspaceMinimumRole } from "@/lib/workspace-access";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { createPmo, listPmosWithProjects, normalizePmoType } from "@/lib/pmos/pmo-service";

const ROUTE_ID = "/api/pmos";

function handleAccessError(error: unknown) {
  if (error instanceof AccessDeniedError) {
    if (String(error.metadata.reason) === "unauthorized") {
      return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
    }
    return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Forbidden" });
  }
  return null;
}

/**
 * PMO mutation routes require workspace role pm-or-above (owner/admin/pm),
 * matching the "workspace managers can manage pmos" RLS policy exactly —
 * app-layer enforcement so a viewer gets a clean 403 instead of relying
 * solely on the RLS write rejecting and surfacing as a generic 500.
 */
async function requirePmoManagerRole(workspaceId: string): Promise<NextResponse | null> {
  try {
    await requireWorkspaceMinimumRole(workspaceId, "pm");
    return null;
  } catch {
    return denyResponse({ status: 403, routeId: ROUTE_ID, message: "Forbidden", reason: "insufficient_role", eventType: "workspace_scope_violation" });
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const resolution = await resolvePreferredWorkspace(user.id);
    if (!resolution.workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE_ID, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id, eventType: "workspace_scope_violation" });
    }
    await requireWorkspaceMember(resolution.workspaceId);

    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
    const pmos = await listPmosWithProjects(resolution.workspaceId, { includeArchived });
    return NextResponse.json({ workspaceId: resolution.workspaceId, pmos });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const resolution = await resolvePreferredWorkspace(user.id);
    if (!resolution.workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE_ID, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id, eventType: "workspace_scope_violation" });
    }
    await requireWorkspaceMember(resolution.workspaceId);
    const roleDenied = await requirePmoManagerRole(resolution.workspaceId);
    if (roleDenied) return roleDenied;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "PMO name is required." }, { status: 400 });
    }

    const pmo = await createPmo({
      workspaceId: resolution.workspaceId,
      name,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      pmoType: normalizePmoType(body.pmoType) ?? "company_pmo",
      icon: typeof body.icon === "string" && body.icon.trim() ? body.icon.trim() : null,
      color: typeof body.color === "string" && body.color.trim() ? body.color.trim() : null,
      createdByUserId: user.id,
    });

    return NextResponse.json({ pmo }, { status: 201 });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    return safeLegacyErrorResponse(ROUTE_ID, error, "Unable to create PMO.");
  }
}
