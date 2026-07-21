import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { listWorkspaceMembersForAssignment } from "@/lib/workspace-team";
import { getProjectWorkspaceId } from "@/lib/projects/project-admin-service";

const ROUTE = "/api/workspace-team/members";

/**
 * Real workspace members only, for the Quick Add Task assignee selector.
 * Never the separate pm-registry directory — that is a manually curated
 * list, not workspace membership. Accepts either workspaceId or projectId
 * (resolved to its own workspace_id server-side — never trusted from the
 * client) so callers that only know a project don't need to separately
 * resolve and thread a workspaceId through props.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
    const requestedWorkspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
    const projectId = request.nextUrl.searchParams.get("projectId")?.trim();

    let workspaceId = requestedWorkspaceId || null;
    if (!workspaceId && projectId) {
      workspaceId = await getProjectWorkspaceId(projectId);
    }
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "workspaceId or projectId is required.", failureClass: "validation_failed" },
        { status: 400 },
      );
    }

    const members = await listWorkspaceMembersForAssignment(workspaceId);
    return NextResponse.json({ ok: true, data: members });
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
