import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  listAgentExecutionRequests,
  createGovernedAgentExecutionRequest,
  normalizeCreateAgentExecutionRequestInput,
} from "@/lib/agents";

const ROUTE = "/api/agents/execution/requests";

export async function GET(request: Request) {
  try {
    const { user: _user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(_user.id);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const filters = {
      executionState: url.searchParams.get("executionState") ?? undefined,
      executionMode: url.searchParams.get("executionMode") ?? undefined,
      riskLevel: url.searchParams.get("riskLevel") ?? undefined,
      toolKey: url.searchParams.get("toolKey") ?? undefined,
      agentId: url.searchParams.get("agentId") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    } as Parameters<typeof listAgentExecutionRequests>[1];

    const requests = await listAgentExecutionRequests(workspaceId, filters);
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
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    let normalized;
    try {
      normalized = normalizeCreateAgentExecutionRequestInput({ ...body, requestedBy: body.requestedBy ?? user.id });
    } catch (err) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 422 });
    }

    const executionRequest = await createGovernedAgentExecutionRequest(normalized);
    return NextResponse.json({ ok: true, data: { executionRequest } }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
