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

function accessDeniedResponse(error: AccessDeniedError) {
  if (String(error.metadata.reason) === "unauthorized") {
    return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
  }
  return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
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
    if (error instanceof AccessDeniedError) return accessDeniedResponse(error);
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
    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    // Only pass a field when the client included it. Non-string values for optional
    // string fields are rejected rather than silently clearing stored data.
    const nameField = "name" in body
      ? (typeof body.name === "string" ? body.name : undefined)
      : undefined;
    const descriptionField = "description" in body
      ? (body.description === null || typeof body.description === "string" ? body.description as string | null : (() => { throw new Error("invalid_description"); })())
      : undefined;
    const statusField = "status" in body
      ? (typeof body.status === "string" ? body.status as ProgramStatus : undefined)
      : undefined;
    const startDateField = "startDate" in body
      ? (body.startDate === null || typeof body.startDate === "string" ? body.startDate as string | null : (() => { throw new Error("invalid_startDate"); })())
      : undefined;
    const targetDateField = "targetDate" in body
      ? (body.targetDate === null || typeof body.targetDate === "string" ? body.targetDate as string | null : (() => { throw new Error("invalid_targetDate"); })())
      : undefined;

    const result = await updateProgram(id, workspaceId, {
      name: nameField,
      description: descriptionField,
      status: statusField,
      startDate: startDateField,
      targetDate: targetDateField,
      actorId: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : result.failureClass === "validation_failed" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ program: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDeniedResponse(error);
    if (error instanceof Error && error.message.startsWith("invalid_")) {
      const field = error.message.replace("invalid_", "");
      return NextResponse.json({ error: `${field} must be a string or null.` }, { status: 400 });
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
    if (error instanceof AccessDeniedError) return accessDeniedResponse(error);
    throw error;
  }
}
