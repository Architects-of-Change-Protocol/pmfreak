import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createImplementationPlanningWorkspaceFromApprovalPack,
  listAgentPmoImplementationPlanningWorkspaces,
} from "@/lib/agents";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const workspaces = await listAgentPmoImplementationPlanningWorkspaces(workspaceId, { status: status as never, limit });
    return NextResponse.json({ ok: true, data: workspaces });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

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
    if (!summary) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_SUMMARY", message: "summary required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const workspace = await createImplementationPlanningWorkspaceFromApprovalPack({
      workspaceId,
      approvalPackId,
      title: title ?? "Implementation Planning Workspace",
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
