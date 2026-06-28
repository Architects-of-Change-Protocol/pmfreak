import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import {
  listAgentExecutionEvidence,
  createEvidenceForExecutionResult,
  normalizeCreateAgentExecutionEvidenceInput,
} from "@/lib/agents";

const ROUTE = "/api/agents/execution/evidence";

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

    const evidence = await listAgentExecutionEvidence({
      workspaceId,
      resultId: url.searchParams.get("resultId") ?? undefined,
      executionRequestId: url.searchParams.get("executionRequestId") ?? undefined,
      adapterExecutionId: url.searchParams.get("adapterExecutionId") ?? undefined,
      evidenceType: url.searchParams.get("evidenceType") as never ?? undefined,
      evidenceSource: url.searchParams.get("evidenceSource") as never ?? undefined,
      scopeType: url.searchParams.get("scopeType") ?? undefined,
      scopeId: url.searchParams.get("scopeId") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ ok: true, data: { evidence } });
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
      normalized = normalizeCreateAgentExecutionEvidenceInput({ ...body, createdBy: body.createdBy ?? user.id });
    } catch (err) {
      return NextResponse.json({ ok: false, error: { code: "VALIDATION_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 422 });
    }

    const evidence = await createEvidenceForExecutionResult(normalized);
    return NextResponse.json({ ok: true, data: { evidence } }, { status: 201 });
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
