import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  archiveProgramRoadmapSource,
  getProgramRoadmapSource,
  updateProgramRoadmapSource,
} from "@/lib/program-roadmap-sources";
import type { ProgramRoadmapSourceStatus } from "@/lib/program-roadmap-sources";

const ROUTE = "/api/programs/[id]/roadmap-sources/[sourceId]";

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
    const { sourceId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await getProgramRoadmapSource(sourceId, workspaceId);
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ roadmapSource: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { sourceId } = await params;
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

    const rawTextField = "rawText" in body ? (typeof body.rawText === "string" ? body.rawText : undefined) : undefined;
    const titleField = "title" in body
      ? (body.title === null || typeof body.title === "string" ? body.title as string | null : (() => { throw new Error("invalid_title"); })())
      : undefined;
    const statusField = "status" in body ? (typeof body.status === "string" ? body.status as ProgramRoadmapSourceStatus : undefined) : undefined;
    const metadataField = "metadata" in body
      ? (body.metadata === null || (typeof body.metadata === "object" && !Array.isArray(body.metadata)) ? body.metadata as Record<string, unknown> | null : (() => { throw new Error("invalid_metadata"); })())
      : undefined;

    const result = await updateProgramRoadmapSource(sourceId, workspaceId, {
      rawText: rawTextField,
      title: titleField,
      status: statusField,
      metadata: metadataField,
      actorId: user.id,
    });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : result.failureClass === "validation_failed" ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ roadmapSource: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    if (error instanceof Error && error.message.startsWith("invalid_")) {
      const field = error.message.replace("invalid_", "");
      return NextResponse.json({ error: `${field} must be a string, null, or object.` }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { sourceId } = await params;
    const { user } = await requireAuthenticatedUser();
    const workspaceId = await resolveContext(user.id);
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await archiveProgramRoadmapSource(sourceId, workspaceId, user.id);
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ roadmapSource: result.data });
  } catch (error) {
    if (error instanceof AccessDeniedError) return accessDenied(error);
    throw error;
  }
}
