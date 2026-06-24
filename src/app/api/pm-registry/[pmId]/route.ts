import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  getProjectManager,
  updateProjectManager,
} from "@/lib/pm-registry";
import type { ProjectManagerStatus } from "@/lib/pm-registry";

const ROUTE = "/api/pm-registry/[pmId]";

type Props = { params: Promise<{ pmId: string }> };

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { pmId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await getProjectManager(pmId, workspaceId);
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

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { pmId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    let body: { displayName?: unknown; email?: unknown; status?: unknown };
    try {
      body = await request.json() as typeof body;
    } catch {
      return NextResponse.json({ ok: false, error: { code: "invalid_body", message: "Request body must be valid JSON." } }, { status: 400 });
    }

    const VALID_STATUSES: ProjectManagerStatus[] = ["active", "inactive", "suspended"];
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status as ProjectManagerStatus)) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: `status must be one of: ${VALID_STATUSES.join(", ")}.` } }, { status: 400 });
    }

    const result = await updateProjectManager({
      workspaceId,
      pmId,
      displayName: typeof body.displayName === "string" ? body.displayName : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      status: body.status as ProjectManagerStatus | undefined,
      actorId: user.id,
    });

    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : result.failureClass === "validation" ? 400 : 500;
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
