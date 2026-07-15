import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { executeDryRunSimulation } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, dryRunRequestId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!dryRunRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "dryRunRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const execution = await executeDryRunSimulation({ workspaceId, dryRunRequestId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: execution }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/execute", err);
  }
}
