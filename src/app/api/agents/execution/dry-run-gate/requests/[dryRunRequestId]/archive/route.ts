import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archiveDryRunExecutionRequest } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ dryRunRequestId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { dryRunRequestId } = await params;
    const body = await request.json();
    const { workspaceId, rationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!rationale) return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rationale required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const record = await archiveDryRunExecutionRequest({ workspaceId, dryRunRequestId, rationale, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/requests/[dryRunRequestId]/archive", err);
  }
}
