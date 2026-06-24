import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { generatePMCapacitySnapshot } from "@/lib/pm-capacity";

const ROUTE = "/api/pm-capacity/[pmId]/snapshot";

export async function POST(
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

    const result = await generatePMCapacitySnapshot({ workspaceId, pmId, actorId: user.id });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : result.failureClass === "validation" ? 400 : 500;
      const code = result.failureClass === "not_found" ? "PM_CAPACITY_PM_NOT_FOUND" : "PM_CAPACITY_SNAPSHOT_GENERATION_FAILED";
      return NextResponse.json({ ok: false, error: { code, message: result.error } }, { status });
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
