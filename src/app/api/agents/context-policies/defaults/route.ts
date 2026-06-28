// POST /api/agents/context-policies/defaults

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { ensureDefaultAgentContextPolicy } from "@/lib/agents";

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
    if (error instanceof AccessDeniedError) return denyFromAccessError(error);
    console.error("[/api/agents/context-policies/defaults] POST error:", error);
    return denyResponse("Failed to seed default context policy.");
  }
}
