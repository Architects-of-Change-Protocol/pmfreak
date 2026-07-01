import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  assignProjectManager,
  listProjectAssignments,
  PM_ASSIGNMENT_TYPES,
} from "@/lib/pm-registry";
import type { PMAssignmentType } from "@/lib/pm-registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_MANAGER_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProjectManagerRow } from "@/lib/db/database-contract";

const ROUTE = "/api/projects/[id]/pm-assignments";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { id: projectId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    // Verify project belongs to workspace
    const supabase = await createSupabaseServerClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found in this workspace." } }, { status: 404 });
    }

    const result = await listProjectAssignments(workspaceId, projectId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: { code: result.failureClass, message: result.error } }, { status: 500 });
    }

    // Enrich with PM display info — fetch distinct PMs in one query
    const pmIds = [...new Set(result.data.map((a) => a.pm_id))];
    const pmMap: Record<string, { display_name: string; email: string }> = {};
    if (pmIds.length > 0) {
      const PM_COLS = PROJECT_MANAGER_SELECTABLE_COLUMNS.join(",");
      const { data: pms } = await supabase
        .from("project_managers")
        .select(PM_COLS)
        .in("id", pmIds)
        .eq("workspace_id", workspaceId)
        .returns<ProjectManagerRow[]>();
      if (pms) {
        for (const pm of pms) {
          pmMap[pm.id] = { display_name: pm.display_name, email: pm.email };
        }
      }
    }

    const enriched = result.data.map((a) => ({
      ...a,
      pm_display_name: pmMap[a.pm_id]?.display_name ?? null,
      pm_email: pmMap[a.pm_id]?.email ?? null,
    }));

    return NextResponse.json({ ok: true, data: enriched });
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

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { id: projectId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    let body: { pmId?: unknown; assignmentType?: unknown };
    try {
      body = await request.json() as typeof body;
    } catch {
      return NextResponse.json({ ok: false, error: { code: "invalid_body", message: "Request body must be valid JSON." } }, { status: 400 });
    }

    if (typeof body.pmId !== "string" || !body.pmId.trim()) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: "pmId is required." } }, { status: 400 });
    }
    if (!PM_ASSIGNMENT_TYPES.includes(body.assignmentType as PMAssignmentType)) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: `assignmentType must be one of: ${PM_ASSIGNMENT_TYPES.join(", ")}.` } }, { status: 400 });
    }

    // Verify project belongs to workspace
    const supabase = await createSupabaseServerClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ ok: false, error: { code: "not_found", message: "Project not found in this workspace." } }, { status: 404 });
    }

    const result = await assignProjectManager({
      workspaceId,
      pmId: body.pmId,
      projectId,
      assignmentType: body.assignmentType as PMAssignmentType,
      actorId: user.id,
    });

    if (!result.ok) {
      const httpStatus =
        result.failureClass === "PM_ACTIVE_PROJECT_LIMIT_EXCEEDED" ? 422
        : result.failureClass === "validation" ? 409
        : result.failureClass === "not_found" ? 404
        : 500;
      return NextResponse.json(
        { ok: false, error: { code: result.failureClass, message: result.error, details: result.details ?? null } },
        { status: httpStatus }
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
