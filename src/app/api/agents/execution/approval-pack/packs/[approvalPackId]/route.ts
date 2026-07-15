import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoApprovalPackById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ approvalPackId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { approvalPackId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const pack = await getAgentPmoApprovalPackById(workspaceId, approvalPackId);
    if (!pack) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Approval pack not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: pack });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/packs/[approvalPackId]", err);
  }
}
