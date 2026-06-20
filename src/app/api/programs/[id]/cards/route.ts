import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { createProgramCard, listProgramCards } from "@/lib/program-cards";
import type { ProgramCardType, ProgramItemStatus } from "@/lib/program-cards";

const ROUTE = "/api/programs/[id]/cards";

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
    const result = await listProgramCards(id, workspaceId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ cards: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}

export async function POST(
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
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title is required." }, { status: 400 });
    }
    if (typeof body.type !== "string") {
      return NextResponse.json({ error: "type is required." }, { status: 400 });
    }
    if (typeof body.orderIndex !== "number") {
      return NextResponse.json({ error: "orderIndex is required." }, { status: 400 });
    }
    const result = await createProgramCard({
      workspaceId,
      programId: id,
      epicId: typeof body.epicId === "string" ? body.epicId : null,
      sprintId: typeof body.sprintId === "string" ? body.sprintId : null,
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      promptBody: typeof body.promptBody === "string" ? body.promptBody : null,
      type: body.type as ProgramCardType,
      status: typeof body.status === "string" ? body.status as ProgramItemStatus : undefined,
      orderIndex: body.orderIndex,
      actorId: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "validation_failed" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ card: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
