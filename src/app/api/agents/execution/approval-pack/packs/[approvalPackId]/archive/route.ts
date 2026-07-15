import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archiveApprovalPack } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ approvalPackId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { approvalPackId } = await params;
    const body = await request.json();
    const { workspaceId, rationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!rationale) return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rationale required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const archived = await archiveApprovalPack({ workspaceId, approvalPackId, rationale, actorId: user.id ?? null });
    if (!archived) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Approval pack not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: archived });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/packs/[approvalPackId]/archive", err);
  }
}
