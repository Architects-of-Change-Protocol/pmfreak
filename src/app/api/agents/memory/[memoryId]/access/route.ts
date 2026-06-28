// POST /api/agents/memory/[memoryId]/access

import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { checkAgentMemoryAccess } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ memoryId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { memoryId } = await params;
    const body = await request.json();
    const workspaceId = body?.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId is required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await checkAgentMemoryAccess({
      workspaceId,
      memoryId,
      agentId: body?.agentId ?? null,
      agentType: body?.agentType ?? null,
      scopeType: body?.scopeType,
      scopeId: body?.scopeId,
      allowedSensitivity: body?.allowedSensitivity,
    });

    return NextResponse.json({ ok: true, data: { access: result } });
  } catch (error) {
    if (error instanceof AccessDeniedError) return denyFromAccessError(error);
    console.error("[/api/agents/memory/[memoryId]/access] POST error:", error);
    return denyResponse("Failed to check memory access.");
  }
}
