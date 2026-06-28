import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  listAgentExecutionResults,
  createResultFromPayload,
  normalizeCreateAgentExecutionResultInput,
} from "@/lib/agents";

const ROUTE = "/api/agents/execution/results";

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
      resultStatus: url.searchParams.get("resultStatus") ?? undefined,
      reviewState: url.searchParams.get("reviewState") ?? undefined,
      resultType: url.searchParams.get("resultType") ?? undefined,
      toolKey: url.searchParams.get("toolKey") ?? undefined,
      adapterKey: url.searchParams.get("adapterKey") ?? undefined,
      executionRequestId: url.searchParams.get("executionRequestId") ?? undefined,
      adapterExecutionId: url.searchParams.get("adapterExecutionId") ?? undefined,
      scopeType: url.searchParams.get("scopeType") ?? undefined,
      scopeId: url.searchParams.get("scopeId") ?? undefined,
      confidenceLevel: url.searchParams.get("confidenceLevel") ?? undefined,
      retentionPolicy: url.searchParams.get("retentionPolicy") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    } as Parameters<typeof listAgentExecutionResults>[1];

    const results = await listAgentExecutionResults(workspaceId, filters);
    return NextResponse.json({ ok: true, data: { results } });
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
      normalized = normalizeCreateAgentExecutionResultInput({ ...body, createdBy: body.createdBy ?? user.id });
    } catch (err) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 422 });
    }

    const result = await createResultFromPayload(normalized);
    return NextResponse.json({ ok: true, data: { result } }, { status: 201 });
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
