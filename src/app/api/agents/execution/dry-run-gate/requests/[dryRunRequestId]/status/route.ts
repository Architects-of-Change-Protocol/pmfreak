import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoDryRunExecutionRequestStatus, getAgentPmoDryRunExecutionRequestById } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ dryRunRequestId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { dryRunRequestId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!status) return NextResponse.json({ ok: false, error: { code: "MISSING_STATUS", message: "status required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const existing = await getAgentPmoDryRunExecutionRequestById(dryRunRequestId);
    if (!existing || existing.workspaceId !== workspaceId) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    const updated = await updateAgentPmoDryRunExecutionRequestStatus(dryRunRequestId, status);
    if (!updated) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
