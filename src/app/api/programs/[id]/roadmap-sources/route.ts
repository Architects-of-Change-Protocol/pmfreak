import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { createProgramRoadmapSource, listProgramRoadmapSources } from "@/lib/program-roadmap-sources";
import type { ProgramRoadmapSourceType, ProgramRoadmapSourceStatus } from "@/lib/program-roadmap-sources";

const ROUTE = "/api/programs/[id]/roadmap-sources";

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
    const result = await listProgramRoadmapSources(id, workspaceId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ roadmapSources: result.data });
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
    if (typeof body.rawText !== "string" || !body.rawText.trim()) {
      return NextResponse.json({ error: "rawText is required." }, { status: 400 });
    }
    if (typeof body.sourceType !== "string") {
      return NextResponse.json({ error: "sourceType is required." }, { status: 400 });
    }
    const result = await createProgramRoadmapSource({
      workspaceId,
      programId: id,
      rawText: body.rawText,
      sourceType: body.sourceType as ProgramRoadmapSourceType,
      title: typeof body.title === "string" ? body.title : null,
      status: typeof body.status === "string" ? body.status as ProgramRoadmapSourceStatus : undefined,
      metadata: body.metadata != null && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : null,
      createdBy: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "validation_failed" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ roadmapSource: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
