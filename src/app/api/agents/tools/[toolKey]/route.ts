import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  getAgentToolByKey,
  updateAgentToolStatus,
} from "@/lib/agents";
import type { AgentToolStatus } from "@/lib/agents";

const ROUTE = "/api/agents/tools/[toolKey]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ toolKey: string }> }
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { toolKey } = await params;
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(user.id);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const tool = await getAgentToolByKey(workspaceId, toolKey);
    if (!tool) {
      return NextResponse.json({ ok: false, error: { code: "TOOL_NOT_FOUND", message: `Tool '${toolKey}' not found.` } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { tool } });
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ toolKey: string }> }
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { toolKey } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const validStatuses: AgentToolStatus[] = ["active", "disabled", "deprecated"];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: `status must be one of: ${validStatuses.join(", ")}` } }, { status: 422 });
    }

    const tool = await updateAgentToolStatus(workspaceId, toolKey, body.status as AgentToolStatus);
    return NextResponse.json({ ok: true, data: { tool } });
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
