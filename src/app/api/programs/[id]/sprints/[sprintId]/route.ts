import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { archiveProgramSprint, updateProgramSprint } from "@/lib/program-sprints";
import type { ProgramItemStatus } from "@/lib/program-sprints";

const ROUTE = "/api/programs/[id]/sprints/[sprintId]";

async function resolveContext(userId: string) {
  const workspaces = await getUserWorkspaces(userId);
  return workspaces[0]?.id ?? null;
}

function accessDenied(error: AccessDeniedError) {
  if (String(error.metadata.reason) === "unauthorized") {
    return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
  }
  return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { sprintId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    const titleField = "title" in body ? (typeof body.title === "string" ? body.title : undefined) : undefined;
    const descriptionField = "description" in body
      ? (body.description === null || typeof body.description === "string" ? body.description as string | null : (() => { throw new Error("invalid_description"); })())
      : undefined;
    const objectiveField = "objective" in body
      ? (body.objective === null || typeof body.objective === "string" ? body.objective as string | null : (() => { throw new Error("invalid_objective"); })())
      : undefined;
    const statusField = "status" in body ? (typeof body.status === "string" ? body.status as ProgramItemStatus : undefined) : undefined;
    const orderIndexField = "orderIndex" in body ? (typeof body.orderIndex === "number" ? body.orderIndex : undefined) : undefined;

    const result = await updateProgramSprint(sprintId, workspaceId, {
      title: titleField,
      description: descriptionField,
      objective: objectiveField,
      status: statusField,
      orderIndex: orderIndexField,
      actorId: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : result.failureClass === "validation_failed" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ sprint: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    if (error instanceof Error && error.message.startsWith("invalid_")) {
      const field = error.message.replace("invalid_", "");
      return NextResponse.json({ error: `${field} must be a string or null.` }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sprintId: string }> }
) {
  try {
    const { sprintId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await archiveProgramSprint(sprintId, workspaceId, user.id);
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ sprint: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
