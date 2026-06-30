import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateHandoffContinuityCheck, validateAgentPmoHandoffContinuityCheckStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ checkId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { checkId } = await params;
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    if (!validateAgentPmoHandoffContinuityCheckStatus(body.checkStatus)) return NextResponse.json({ ok: false, error: { code: "INVALID_STATUS", message: "Invalid checkStatus" } }, { status: 400 });
    const record = await updateHandoffContinuityCheck(body.workspaceId, checkId, body.checkStatus, body.rationale);
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
