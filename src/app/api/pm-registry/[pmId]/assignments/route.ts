import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { listProjectManagerProjects } from "@/lib/pm-registry";

const ROUTE = "/api/pm-registry/[pmId]/assignments";

type Props = { params: Promise<{ pmId: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { pmId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const { searchParams } = new URL(request.url);
    const includeRemoved = searchParams.get("includeRemoved") === "true";

    const result = await listProjectManagerProjects({ workspaceId, pmId, includeRemoved });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: { code: result.failureClass, message: result.error } }, { status: 500 });
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
