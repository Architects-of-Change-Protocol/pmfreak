// POST /api/agents/memory/[memoryId]/revoke

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { revokeMemory } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ memoryId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { memoryId } = await params;
    const body = await request.json();
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const memory = await revokeMemory({ workspaceId, memoryId, actorId: user.id, reason: body?.reason ?? null });
    return NextResponse.json({ ok: true, data: { memory } });
  } catch (error) {
    if (error instanceof AccessDeniedError) return denyFromAccessError(error);
    console.error("[/api/agents/memory/[memoryId]/revoke] POST error:", error);
    return denyResponse("Failed to revoke memory.");
  }
}
