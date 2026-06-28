// POST /api/agents/audit/events — record an audit event
// GET  /api/agents/audit/events — list audit events

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordAgentAuditEvent, listAgentAuditEvents } from "@/lib/agents";

const ROUTE = "/api/agents/audit/events";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, ...rest } = body ?? {};
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const event = await recordAgentAuditEvent({ workspaceId, ...rest });
    return NextResponse.json({ ok: true, data: { event } }, { status: 201 });
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
      category: url.searchParams.get("category") ?? undefined,
      eventType: url.searchParams.get("event_type") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
      outcome: url.searchParams.get("outcome") ?? undefined,
      sourceType: url.searchParams.get("source_type") ?? undefined,
      scopeType: url.searchParams.get("scope_type") ?? undefined,
      scopeId: url.searchParams.get("scope_id") ?? undefined,
      agentId: url.searchParams.get("agent_id") ?? undefined,
      agentType: url.searchParams.get("agent_type") ?? undefined,
      actorId: url.searchParams.get("actor_id") ?? undefined,
      projectId: url.searchParams.get("project_id") ?? undefined,
      pmId: url.searchParams.get("pm_id") ?? undefined,
      portfolioId: url.searchParams.get("portfolio_id") ?? undefined,
      toolKey: url.searchParams.get("tool_key") ?? undefined,
      correlationId: url.searchParams.get("correlation_id") ?? undefined,
      occurredFrom: url.searchParams.get("occurred_from") ?? undefined,
      occurredTo: url.searchParams.get("occurred_to") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };

    const events = await listAgentAuditEvents(workspaceId, filters as Parameters<typeof listAgentAuditEvents>[1]);
    return NextResponse.json({ ok: true, data: { events } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to list audit events." } }, { status: 500 });
  }
}
