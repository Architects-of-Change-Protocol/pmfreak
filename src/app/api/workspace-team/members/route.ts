import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import {
  listWorkspaceMembersForAssignment,
  removeWorkspaceMember,
  WorkspaceMembershipAuditError,
  WorkspaceMembershipRemovalError,
} from "@/lib/workspace-team";
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

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = (await request.json()) as { workspaceId?: unknown; targetUserId?: unknown };
    if (typeof body.workspaceId !== "string" || typeof body.targetUserId !== "string" || !body.workspaceId.trim() || !body.targetUserId.trim()) {
      return NextResponse.json({ ok: false, failureClass: "invalid_offboarding_request" }, { status: 400 });
    }
    const workspaceId = body.workspaceId.trim();

    // OFFBOARDING_AUTHORIZATION_MODEL =
    //   AUTHENTICATED_SESSION_PLUS_SERVER_RESOLVED_WORKSPACE_HIERARCHY
    //
    // OFFBOARDING_FRONTERA_GOVERNED=NO — an explicit beta architecture decision,
    // not an accidental omission. `requireGovernancePermission` cannot support
    // this boundary: it performs its own check and then calls
    // `requireWorkspaceMembership`, whose "read" permission maps to the
    // PROJECT-scoped `project.read` policy and is invoked with no projectId, so it
    // denies every caller unconditionally. Proven at runtime: a legitimate
    // workspace owner received 403 "project scope is missing for project-scoped
    // action". See RR-GOVERNANCE-PERMISSION-GUARD-BROKEN.
    //
    // The authority actually enforced here: the session is authenticated above,
    // and `removeWorkspaceMember` resolves BOTH the actor's and the target's
    // membership server-side from `workspace_memberships` and applies the
    // canonical owner/admin hierarchy. No client-supplied role or authority field
    // is trusted; a caller with no actor membership in the requested workspace
    // fails closed, cross-tenant callers included.
    const result = await removeWorkspaceMember({ workspaceId, actorUserId: user.id, targetUserId: body.targetUserId.trim() });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof WorkspaceMembershipRemovalError) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Membership removal denied", reason: error.reason });
    }
    if (error instanceof WorkspaceMembershipAuditError) {
      // The membership IS removed; the audit event is not. Surfaced rather than
      // reported as a clean success. See RR-OFFBOARDING-AUDIT-NONATOMIC.
      return NextResponse.json(
        { ok: false, failureClass: "offboarding_audit_write_failed", detail: error.detail },
        { status: 500 },
      );
    }
    if (error instanceof AccessDeniedError) {
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    throw error;
  }
}
