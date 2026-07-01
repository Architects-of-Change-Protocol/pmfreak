import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { PM_ASSIGNMENT_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { PMAssignmentRow } from "@/lib/db/database-contract";
import { unassignProjectManager } from "@/lib/pm-registry";
import type { PMAssignmentType } from "@/lib/pm-registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROUTE = "/api/projects/[id]/pm-assignments/[assignmentId]";

type Props = { params: Promise<{ id: string; assignmentId: string }> };

export async function DELETE(_request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { id: projectId, assignmentId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const supabase = await createSupabaseServerClient();
    const ASSIGN_COLS = PM_ASSIGNMENT_SELECTABLE_COLUMNS.join(",");

    // Fetch assignment to verify ownership and get pm_id/type
    const { data: assignment } = await supabase
      .from("pm_assignments")
      .select(ASSIGN_COLS)
      .eq("id", assignmentId)
      .eq("project_id", projectId)
      .eq("workspace_id", workspaceId)
      .maybeSingle<PMAssignmentRow>();

    if (!assignment) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Assignment not found." } }, { status: 404 });
    }

    if (assignment.removed_at !== null) {
      return NextResponse.json({ ok: false, error: { code: "already_removed", message: "Assignment is already removed." } }, { status: 409 });
    }

    const result = await unassignProjectManager({
      workspaceId,
      pmId: assignment.pm_id,
      projectId,
      assignmentType: assignment.assignment_type as PMAssignmentType,
      actorId: user.id,
    });

    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ ok: false, error: { code: result.failureClass, message: result.error } }, { status });
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
