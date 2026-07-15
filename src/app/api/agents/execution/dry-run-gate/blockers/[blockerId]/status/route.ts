import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoDryRunBlockerStatus, getAgentPmoDryRunBlockerById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ blockerId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { blockerId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: { code: "MISSING_STATUS", message: "status required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const blocker = await getAgentPmoDryRunBlockerById(blockerId);
    if (!blocker || blocker.workspaceId !== workspaceId) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    const updated = await updateAgentPmoDryRunBlockerStatus(blockerId, status);
    if (!updated) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/blockers/[blockerId]/status", err);
  }
}
