import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { executePolicyActivation } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, activationRequestId, controlledPolicyVersionId, executionRationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!activationRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "activationRequestId required" } }, { status: 400 });
    if (!controlledPolicyVersionId) return NextResponse.json({ ok: false, error: { code: "MISSING_VERSION_ID", message: "controlledPolicyVersionId required" } }, { status: 400 });
    if (!executionRationale) return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "executionRationale required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await executePolicyActivation({ workspaceId, activationRequestId, controlledPolicyVersionId, executionRationale, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
