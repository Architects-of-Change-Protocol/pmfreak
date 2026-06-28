// GET /api/agents/audit/timeline

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentTimeline } from "@/lib/agents";

const ROUTE = "/api/agents/audit/timeline";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const timeline = await getAgentTimeline({
      workspaceId,
      correlationId: url.searchParams.get("correlation_id") ?? undefined,
      agentId: url.searchParams.get("agent_id") ?? undefined,
      agentType: url.searchParams.get("agent_type") ?? undefined,
      projectId: url.searchParams.get("project_id") ?? undefined,
      pmId: url.searchParams.get("pm_id") ?? undefined,
      portfolioId: url.searchParams.get("portfolio_id") ?? undefined,
      scopeType: url.searchParams.get("scope_type") as never ?? undefined,
      scopeId: url.searchParams.get("scope_id") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ ok: true, data: { timeline } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to get timeline." } }, { status: 500 });
  }
}
