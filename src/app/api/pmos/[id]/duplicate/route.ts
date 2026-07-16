import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { safeLegacyErrorResponse } from "@/lib/security/safe-route-error";
import { duplicatePmo } from "@/lib/pmos/pmo-service";

const ROUTE_ID = "/api/pmos/[id]/duplicate";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const { user } = await requireAuthenticatedUser();
    const pmoId = id.trim();
    if (!pmoId) return NextResponse.json({ error: "PMO id is required." }, { status: 400 });

    const resolution = await resolvePreferredWorkspace(user.id);
    if (!resolution.workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE_ID, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id, eventType: "workspace_scope_violation" });
    }
    await requireWorkspaceMember(resolution.workspaceId);

    const pmo = await duplicatePmo(resolution.workspaceId, pmoId, user.id);
    return NextResponse.json({ pmo }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE_ID, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE_ID, message: "Forbidden" });
    }
    return safeLegacyErrorResponse(ROUTE_ID, error, "Unable to duplicate PMO.");
  }
}
