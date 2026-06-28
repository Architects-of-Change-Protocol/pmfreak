import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  requestAgentToolAuthorization,
  listAgentToolRequests,
} from "@/lib/agents";
import { validateCreateAgentToolRequestInput } from "@/lib/agents";
import type { AgentToolRequestStatus } from "@/lib/agents/agent-tool-approval-types";

const ROUTE = "/api/agents/tool-requests";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(user.id);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } },
        { status: 400 }
      );
    }
    await requireWorkspaceMember(workspaceId);

    const filters = {
      agentId: url.searchParams.get("agentId") ?? undefined,
      toolKey: url.searchParams.get("toolKey") ?? undefined,
      status: (url.searchParams.get("status") as AgentToolRequestStatus) ?? undefined,
      requestedBy: url.searchParams.get("requestedBy") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
    };

    const requests = await listAgentToolRequests(workspaceId, filters);
    return NextResponse.json({ ok: true, data: { requests } });
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

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } },
        { status: 400 }
      );
    }
    await requireWorkspaceMember(workspaceId);

    const validationError = validateCreateAgentToolRequestInput(body);
    if (validationError) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message: validationError } },
        { status: 422 }
      );
    }

    const result = await requestAgentToolAuthorization({
      ...body,
      requestedBy: body.requestedBy ?? user.id,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "REQUEST_FAILED", message: result.error } },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, data: { request: result.request } }, { status: 201 });
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
