import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archivePolicyActivationRequest } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ activationRequestId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { activationRequestId } = await params;
    const body = await request.json();
    const { workspaceId, rationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await archivePolicyActivationRequest({
      workspaceId,
      activationRequestId,
      rationale: rationale ?? "Archived by operator.",
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/requests/[activationRequestId]/archive", err);
  }
}
