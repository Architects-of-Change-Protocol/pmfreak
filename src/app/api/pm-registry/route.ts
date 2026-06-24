import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  listProjectManagers,
  registerProjectManager,
} from "@/lib/pm-registry";
import type { ProjectManagerStatus } from "@/lib/pm-registry";

const ROUTE = "/api/pm-registry";

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as ProjectManagerStatus | null;

    const result = await listProjectManagers(workspaceId, status ?? undefined);
    if (!result.ok) return NextResponse.json({ ok: false, error: { code: "list_failed", message: result.error } }, { status: 500 });
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

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    let body: { displayName?: unknown; email?: unknown; userId?: unknown };
    try {
      body = await request.json() as typeof body;
    } catch {
      return NextResponse.json({ ok: false, error: { code: "invalid_body", message: "Request body must be valid JSON." } }, { status: 400 });
    }

    if (typeof body.displayName !== "string" || !body.displayName.trim()) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: "displayName is required." } }, { status: 400 });
    }
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: "email is required." } }, { status: 400 });
    }

    const result = await registerProjectManager({
      workspaceId,
      displayName: body.displayName,
      email: body.email,
      userId: typeof body.userId === "string" ? body.userId : undefined,
      actorId: user.id,
    });

    if (!result.ok) {
      const status = result.failureClass === "validation" ? 400 : 500;
      return NextResponse.json({ ok: false, error: { code: result.failureClass, message: result.error } }, { status });
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
