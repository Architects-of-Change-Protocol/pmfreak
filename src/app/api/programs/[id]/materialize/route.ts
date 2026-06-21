import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { materializeProgramRoadmap } from "@/lib/program-materializations";

const ROUTE = "/api/programs/[id]/materialize";

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

    let body: { parseResultId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof body.parseResultId !== "string" || !body.parseResultId) {
      return NextResponse.json({ error: "parseResultId is required." }, { status: 400 });
    }

    const result = await materializeProgramRoadmap({
      workspaceId,
      programId: id,
      parseResultId: body.parseResultId,
      actorId: user.id,
    });

    if (!result.ok) {
      const status =
        result.failureClass === "not_found" ? 404
        : result.failureClass === "MATERIALIZATION_ALREADY_EXISTS" ? 409
        : result.failureClass === "validation_failed" ? 400
        : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    const { materialization, report } = result.data;
    return NextResponse.json(
      {
        materializationId: materialization.id,
        epicsCreated: report.epicsCreated,
        sprintsCreated: report.sprintsCreated,
        cardsCreated: report.cardsCreated,
        skippedCards: report.skippedCards,
        warnings: report.warnings,
        createdEntities: report.createdEntities,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
