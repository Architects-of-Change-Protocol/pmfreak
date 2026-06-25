import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { generatePMOInterventionActions } from "@/lib/pmo-intervention";

const ROUTE = "POST /api/pmo-interventions/generate";

export async function POST(_request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await generatePMOInterventionActions({ workspaceId, actorId: user.id });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        PMO_INTERVENTION_WORKSPACE_REQUIRED: 403,
        PMO_INTERVENTION_UNAUTHORIZED: 403,
        PMO_INTERVENTION_GENERATION_FAILED: 500,
      };
      return NextResponse.json(
        { ok: false, error: { code: result.failureClass, message: result.error } },
        { status: statusMap[result.failureClass] ?? 500 }
      );
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
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
