import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoPolicyActivationRequestById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(_request: Request, { params }: { params: Promise<{ activationRequestId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { activationRequestId } = await params;
    const record = await getAgentPmoPolicyActivationRequestById(activationRequestId);
    if (!record) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Activation request not found" } }, { status: 404 });
    await requireWorkspaceMember(record.workspaceId);
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/requests/[activationRequestId]", err);
  }
}
