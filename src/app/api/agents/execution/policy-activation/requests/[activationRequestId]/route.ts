import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoPolicyActivationRequestById } from "@/lib/agents";

export async function GET(_request: Request, { params }: { params: Promise<{ activationRequestId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { activationRequestId } = await params;
    const record = await getAgentPmoPolicyActivationRequestById(activationRequestId);
    if (!record) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Activation request not found" } }, { status: 404 });
    await requireWorkspaceMember(record.workspaceId);
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
