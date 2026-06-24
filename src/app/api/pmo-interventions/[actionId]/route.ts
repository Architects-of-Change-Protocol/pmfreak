import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { getPMOInterventionAction } from "@/lib/pmo-intervention";

const ROUTE = "GET /api/pmo-interventions/[actionId]";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const { actionId } = await params;
    const result = await getPMOInterventionAction({ workspaceId, actionId });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        PMO_INTERVENTION_WORKSPACE_REQUIRED: 403,
        PMO_INTERVENTION_ACTION_NOT_FOUND: 404,
      };
      return NextResponse.json(
        { ok: false, error: { code: result.failureClass, message: result.error } },
        { status: statusMap[result.failureClass] ?? 500 }
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
