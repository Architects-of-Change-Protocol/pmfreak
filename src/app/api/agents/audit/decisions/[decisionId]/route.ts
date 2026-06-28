// GET   /api/agents/audit/decisions/[decisionId]
// PATCH /api/agents/audit/decisions/[decisionId]

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { getAgentDecisionEventById, updateAgentDecisionStatus } from "@/lib/agents";

const ROUTE = "/api/agents/audit/decisions/[decisionId]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ decisionId: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { decisionId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const decision = await getAgentDecisionEventById(workspaceId, decisionId);
    if (!decision) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Decision event not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { decision } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to get decision." } }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ decisionId: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { decisionId } = await params;
    const body = await request.json();
    const { workspaceId, status, reason } = body ?? {};
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const decision = await updateAgentDecisionStatus({ workspaceId, decisionId, status, reason: reason ?? null });
    return NextResponse.json({ ok: true, data: { decision } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${ROUTE}] PATCH error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message } }, { status: 500 });
  }
}
