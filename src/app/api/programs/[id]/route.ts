import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { archiveProgram, explainProgram, getProgram, updateProgram } from "@/lib/programs";
import type { ProgramStatus } from "@/lib/programs";

const ROUTE = "/api/programs/[id]";

async function resolveContext(userId: string) {
  const workspaces = await getUserWorkspaces(userId);
  const workspaceId = workspaces[0]?.id;
  return workspaceId ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await getProgram(id, workspaceId);
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ program: result.data, explanation: explainProgram(result.data) });
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const body = await request.json() as Record<string, unknown>;
    const result = await updateProgram(id, workspaceId, {
      name: typeof body.name === "string" ? body.name : undefined,
      description: body.description !== undefined ? (typeof body.description === "string" ? body.description : null) : undefined,
      status: typeof body.status === "string" ? body.status as ProgramStatus : undefined,
      startDate: body.startDate !== undefined ? (typeof body.startDate === "string" ? body.startDate : null) : undefined,
      targetDate: body.targetDate !== undefined ? (typeof body.targetDate === "string" ? body.targetDate : null) : undefined,
      actorId: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : result.failureClass === "validation_failed" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ program: result.data });
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await archiveProgram(id, workspaceId, user.id);
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ program: result.data });
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
