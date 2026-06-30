import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createImplementationPlanningWorkspaceFromApprovalPack } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, approvalPackId, title, summary, planningOwnerRole, changeRequestId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!approvalPackId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_APPROVAL_PACK", message: "approvalPackId required" } }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_TITLE", message: "title required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const workspace = await createImplementationPlanningWorkspaceFromApprovalPack({
      workspaceId,
      approvalPackId,
      title,
      summary: summary ?? "",
      planningOwnerRole: planningOwnerRole ?? null,
      changeRequestId: changeRequestId ?? null,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: workspace }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
