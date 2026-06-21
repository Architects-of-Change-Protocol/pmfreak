import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { archiveProgramRoadmapParseResult, getProgramRoadmapParseResult } from "@/lib/program-roadmap-parser";

const ROUTE = "/api/programs/[id]/roadmap-sources/[sourceId]/parse-results/[parseResultId]";

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
  { params }: { params: Promise<{ id: string; sourceId: string; parseResultId: string }> }
) {
  try {
    const { parseResultId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await getProgramRoadmapParseResult({ workspaceId, parseResultId });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ parseResult: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string; parseResultId: string }> }
) {
  try {
    const { id, parseResultId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await archiveProgramRoadmapParseResult({
      workspaceId,
      programId: id,
      parseResultId,
      actorId: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ parseResult: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
