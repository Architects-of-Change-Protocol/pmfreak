import { NextRequest, NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  getProjectManagerProfile,
  upsertPMProfile,
  PM_ROLES,
  PM_EXPERIENCE_LEVELS,
} from "@/lib/pm-registry";
import type { PMRole, PMExperienceLevel } from "@/lib/pm-registry";

const ROUTE = "/api/pm-registry/[pmId]/profile";

type Props = { params: Promise<{ pmId: string }> };

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { pmId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await getProjectManagerProfile({ workspaceId, pmId });
    if (!result.ok) {
      const status = result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ ok: false, error: { code: result.failureClass, message: result.error } }, { status });
    }
    return NextResponse.json({ ok: true, data: result.data });
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

export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { pmId } = await params;
    const workspaces = await getUserWorkspaces(user.id);
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) {
      return denyResponse({ status: 403, routeId: ROUTE, message: "Workspace context required.", reason: "workspace_missing", actorUserId: user.id });
    }
    await requireWorkspaceMember(workspaceId);

    let body: { role?: unknown; experienceLevel?: unknown; capacityLimit?: unknown; activeProjectsLimit?: unknown };
    try {
      body = await request.json() as typeof body;
    } catch {
      return NextResponse.json({ ok: false, error: { code: "invalid_body", message: "Request body must be valid JSON." } }, { status: 400 });
    }

    if (body.role !== undefined && !PM_ROLES.includes(body.role as PMRole)) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: `role must be one of: ${PM_ROLES.join(", ")}.` } }, { status: 400 });
    }
    if (body.experienceLevel !== undefined && !PM_EXPERIENCE_LEVELS.includes(body.experienceLevel as PMExperienceLevel)) {
      return NextResponse.json({ ok: false, error: { code: "validation", message: `experienceLevel must be one of: ${PM_EXPERIENCE_LEVELS.join(", ")}.` } }, { status: 400 });
    }

    const result = await upsertPMProfile({
      workspaceId,
      pmId,
      role: body.role as PMRole | undefined,
      experienceLevel: body.experienceLevel as PMExperienceLevel | undefined,
      capacityLimit: typeof body.capacityLimit === "number" ? body.capacityLimit : undefined,
      activeProjectsLimit: typeof body.activeProjectsLimit === "number" ? body.activeProjectsLimit : undefined,
      actorId: user.id,
    });

    if (!result.ok) {
      const status = result.failureClass === "validation" ? 400 : 500;
      return NextResponse.json({ ok: false, error: { code: result.failureClass, message: result.error } }, { status });
    }
    return NextResponse.json({ ok: true, data: result.data });
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
