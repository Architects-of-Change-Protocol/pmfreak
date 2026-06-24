import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { listPMPerformanceSnapshots } from "@/lib/pm-performance";

const ROUTE = "/api/pm-performance/[pmId]";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pmId: string }> }
) {
  try {
    const { pmId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await listPMPerformanceSnapshots({ workspaceId, pmId, limit: 10 });
    if (!result.ok) {
      if (result.failureClass === "not_found") {
        return NextResponse.json({ ok: false, error: { code: "PM_PERFORMANCE_PM_NOT_FOUND", message: result.error } }, { status: 404 });
      }
      return NextResponse.json({ ok: false, error: { code: "PM_PERFORMANCE_LIST_FAILED", message: result.error } }, { status: 500 });
    }

    const [latest, ...history] = result.data;
    return NextResponse.json({ ok: true, data: { latest: latest ?? null, history } });
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
