import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoRuntimeHardeningRunById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ hardeningRunId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { hardeningRunId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const record = await getAgentPmoRuntimeHardeningRunById(hardeningRunId);
    if (!record || record.workspaceId !== workspaceId) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/runtime-hardening/runs/[hardeningRunId]", err);
  }
}
