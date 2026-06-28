// POST /api/agents/context-policies/defaults

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { ensureDefaultAgentContextPolicy } from "@/lib/agents";

const ROUTE = "/api/agents/context-policies/defaults";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const policy = await ensureDefaultAgentContextPolicy(workspaceId);
    return NextResponse.json({ ok: true, data: { policy } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] POST error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to seed default context policy." } }, { status: 500 });
  }
}
