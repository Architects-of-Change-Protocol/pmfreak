import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { assembleGovernanceApprovalPack } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!changeRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_CHANGE_REQUEST", message: "changeRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const pack = await assembleGovernanceApprovalPack({ workspaceId, changeRequestId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: pack }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/assemble", err);
  }
}
