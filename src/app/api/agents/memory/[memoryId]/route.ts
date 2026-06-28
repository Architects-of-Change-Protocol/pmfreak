// GET /api/agents/memory/[memoryId]

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentMemoryById } from "@/lib/agents";

const ROUTE = "/api/agents/memory/[memoryId]";

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

    const memory = await getAgentMemoryById(workspaceId, memoryId);
    if (!memory) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Memory record not found." } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { memory } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    console.error(`[${ROUTE}] GET error:`, error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL", message: "Failed to fetch memory record." } }, { status: 500 });
  }
}
