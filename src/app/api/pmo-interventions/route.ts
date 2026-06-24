import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { listPMOInterventionActions } from "@/lib/pmo-intervention";
import type { PMOInterventionStatus, PMOInterventionPriority, PMOInterventionActionType, PMOInterventionTargetType } from "@/lib/pmo-intervention";

const ROUTE = "GET /api/pmo-interventions";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const { searchParams } = new URL(request.url);
    const result = await listPMOInterventionActions({
      workspaceId,
      status: (searchParams.get("status") as PMOInterventionStatus) || undefined,
      priority: (searchParams.get("priority") as PMOInterventionPriority) || undefined,
      actionType: (searchParams.get("actionType") as PMOInterventionActionType) || undefined,
      targetType: (searchParams.get("targetType") as PMOInterventionTargetType) || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: result.failureClass, message: result.error } },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    throw error;
  }
}
