// POST /api/agents/audit/decisions — record a decision event
// GET  /api/agents/audit/decisions — list decision events

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordAgentDecision, listAgentDecisionEvents } from "@/lib/agents";

const ROUTE = "/api/agents/audit/decisions";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, createAuditEvent, ...rest } = body ?? {};
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await recordAgentDecision({ workspaceId, createAuditEvent: createAuditEvent ?? false, ...rest });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${ROUTE}] POST error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const filters = {
      decisionType: url.searchParams.get("decision_type") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      agentId: url.searchParams.get("agent_id") ?? undefined,
      agentType: url.searchParams.get("agent_type") ?? undefined,
      scopeType: url.searchParams.get("scope_type") ?? undefined,
      scopeId: url.searchParams.get("scope_id") ?? undefined,
      projectId: url.searchParams.get("project_id") ?? undefined,
      pmId: url.searchParams.get("pm_id") ?? undefined,
      portfolioId: url.searchParams.get("portfolio_id") ?? undefined,
      correlationId: url.searchParams.get("correlation_id") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };

    const decisions = await listAgentDecisionEvents(workspaceId, filters as Parameters<typeof listAgentDecisionEvents>[1]);
    return NextResponse.json({ ok: true, data: { decisions } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to list decisions." } }, { status: 500 });
  }
}
