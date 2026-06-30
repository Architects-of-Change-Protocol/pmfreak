import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archiveApprovalPack } from "@/lib/agents";

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
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
