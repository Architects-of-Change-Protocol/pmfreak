import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { getLatestProgramRoadmapParseResult } from "@/lib/program-roadmap-parser";

const ROUTE = "/api/programs/[id]/roadmap-sources/[sourceId]/parse-results/latest";

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
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await getLatestProgramRoadmapParseResult({ workspaceId, programId: id, sourceId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    if (!result.data) {
      return NextResponse.json({ parseResult: null }, { status: 200 });
    }
    return NextResponse.json({ parseResult: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
