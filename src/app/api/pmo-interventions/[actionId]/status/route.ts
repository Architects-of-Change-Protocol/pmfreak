import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { updatePMOInterventionActionStatus } from "@/lib/pmo-intervention";
import type { PMOInterventionStatus } from "@/lib/pmo-intervention";

const ROUTE = "POST /api/pmo-interventions/[actionId]/status";

const VALID_STATUSES = new Set<PMOInterventionStatus>([
  "proposed", "approved", "rejected", "in_progress", "completed", "dismissed", "cancelled",
]);

export async function POST(
  request: NextRequest,
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
    const body = await request.json().catch(() => ({}));
    const { status, decisionReason, completionNotes } = body as {
      status?: string;
      decisionReason?: string;
      completionNotes?: string;
    };

    if (!status || !VALID_STATUSES.has(status as PMOInterventionStatus)) {
      return NextResponse.json(
        { ok: false, error: { code: "PMO_INTERVENTION_INVALID_STATUS", message: `Invalid status: ${status ?? "(missing)"}` } },
        { status: 400 }
      );
    }

    const result = await updatePMOInterventionActionStatus({
      workspaceId,
      actionId,
      actorId: user.id,
      status: status as PMOInterventionStatus,
      decisionReason: decisionReason ?? null,
      completionNotes: completionNotes ?? null,
    });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        PMO_INTERVENTION_WORKSPACE_REQUIRED: 403,
        PMO_INTERVENTION_ACTION_NOT_FOUND: 404,
        PMO_INTERVENTION_INVALID_STATUS_TRANSITION: 422,
        PMO_INTERVENTION_STATUS_UPDATE_FAILED: 500,
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
