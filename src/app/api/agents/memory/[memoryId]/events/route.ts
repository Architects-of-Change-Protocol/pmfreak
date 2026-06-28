// GET /api/agents/memory/[memoryId]/events

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentMemoryEvents } from "@/lib/agents";

export async function GET(request: Request, { params }: { params: Promise<{ memoryId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { memoryId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspace_id") ?? url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspace_id is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const events = await listAgentMemoryEvents(workspaceId, memoryId);
    return NextResponse.json({ ok: true, data: { events } });
  } catch (error) {
    if (error instanceof AccessDeniedError) return denyFromAccessError(error);
    console.error("[/api/agents/memory/[memoryId]/events] GET error:", error);
    return denyResponse("Failed to list memory events.");
  }
}
