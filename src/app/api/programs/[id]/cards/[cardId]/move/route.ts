import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { moveProgramCard } from "@/lib/program-board";
import { PROGRAM_BOARD_COLUMNS } from "@/lib/program-board/types";
import type { ProgramBoardColumn } from "@/lib/program-board/types";

const ROUTE = "/api/programs/[id]/cards/[cardId]/move";

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
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    let body: { targetColumn?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof body.targetColumn !== "string" || !PROGRAM_BOARD_COLUMNS.includes(body.targetColumn as ProgramBoardColumn)) {
      return NextResponse.json(
        { error: `targetColumn must be one of: ${PROGRAM_BOARD_COLUMNS.join(", ")}.` },
        { status: 400 }
      );
    }

    const result = await moveProgramCard({
      workspaceId,
      cardId,
      targetColumn: body.targetColumn as ProgramBoardColumn,
      actorId: user.id,
    });

    if (!result.ok) {
      const status =
        result.failureClass === "not_found" ? 404
        : result.failureClass === "INVALID_BOARD_TRANSITION" ? 422
        : result.failureClass === "validation_failed" ? 400
        : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
