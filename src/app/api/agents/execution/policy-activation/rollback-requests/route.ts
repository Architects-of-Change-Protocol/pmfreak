import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createPolicyRollbackRequest, listAgentPmoPolicyRollbackRequests } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, activationRequestId, rollbackReason } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!activationRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "activationRequestId required" } }, { status: 400 });
    if (!rollbackReason) return NextResponse.json({ ok: false, error: { code: "MISSING_REASON", message: "rollbackReason required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await createPolicyRollbackRequest({ workspaceId, activationRequestId, rollbackReason, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/rollback-requests", err);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await listAgentPmoPolicyRollbackRequests(workspaceId);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/rollback-requests", err);
  }
}
