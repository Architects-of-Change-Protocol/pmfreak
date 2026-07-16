import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { deletePmo, getPmoById, normalizePmoType, updatePmo, type UpdatePmoInput } from "@/lib/pmos/pmo-service";

const ROUTE_ID = "/api/pmos/[id]";

type Params = { params: Promise<{ id: string }> };

function handleAccessError(error: unknown) {
  if (error instanceof AccessDeniedError) {
    if (String(error.metadata.reason) === "unauthorized") {
      return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
    }
    return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Forbidden" });
  }
  return null;
}

async function resolveScopedRequest(pmoIdRaw: string) {
  const { user } = await requireAuthenticatedUser();
  const pmoId = pmoIdRaw.trim();
  if (!pmoId) return { error: NextResponse.json({ error: "PMO id is required." }, { status: 400 }) } as const;

  const resolution = await resolvePreferredWorkspace(user.id);
  if (!resolution.workspaceId) {
    return {
      error: denyResponse({ status: 403, routeId: ROUTE_ID, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id, eventType: "workspace_scope_violation" }),
    } as const;
  }
  await requireWorkspaceMember(resolution.workspaceId);
  return { user, workspaceId: resolution.workspaceId, pmoId } as const;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const scoped = await resolveScopedRequest(id);
    if ("error" in scoped) return scoped.error;

    const pmo = await getPmoById(scoped.workspaceId, scoped.pmoId);
    if (!pmo) return NextResponse.json({ error: "PMO not found." }, { status: 404 });
    return NextResponse.json({ pmo });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    throw error;
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const scoped = await resolveScopedRequest(id);
    if ("error" in scoped) return scoped.error;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: UpdatePmoInput = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: "PMO name cannot be empty." }, { status: 400 });
      patch.name = name;
    }
    if (body.description !== undefined) {
      patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    }
    if (body.pmoType !== undefined) {
      const pmoType = normalizePmoType(body.pmoType);
      if (!pmoType) return NextResponse.json({ error: "Invalid PMO type." }, { status: 400 });
      patch.pmoType = pmoType;
    }
    if (body.icon !== undefined) patch.icon = typeof body.icon === "string" && body.icon.trim() ? body.icon.trim() : null;
    if (body.color !== undefined) patch.color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;
    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "archived") {
        return NextResponse.json({ error: "Invalid PMO status." }, { status: 400 });
      }
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const existing = await getPmoById(scoped.workspaceId, scoped.pmoId);
    if (!existing) return NextResponse.json({ error: "PMO not found." }, { status: 404 });

    const pmo = await updatePmo(scoped.workspaceId, scoped.pmoId, patch);
    return NextResponse.json({ pmo });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    return safeLegacyErrorResponse(ROUTE_ID, error, "Unable to update PMO.");
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const scoped = await resolveScopedRequest(id);
    if ("error" in scoped) return scoped.error;

    const existing = await getPmoById(scoped.workspaceId, scoped.pmoId);
    if (!existing) return NextResponse.json({ error: "PMO not found." }, { status: 404 });

    await deletePmo(scoped.workspaceId, scoped.pmoId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const denied = handleAccessError(error);
    if (denied) return denied;
    return safeLegacyErrorResponse(ROUTE_ID, error, "Unable to delete PMO.");
  }
}
