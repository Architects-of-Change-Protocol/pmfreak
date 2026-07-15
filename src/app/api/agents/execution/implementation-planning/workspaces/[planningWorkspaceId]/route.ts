import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentPmoImplementationPlanningWorkspaceById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request, { params }: { params: Promise<{ planningWorkspaceId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { planningWorkspaceId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const workspace = await getAgentPmoImplementationPlanningWorkspaceById(workspaceId, planningWorkspaceId);
    if (!workspace) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Planning workspace not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: workspace });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/workspaces/[planningWorkspaceId]", err);
  }
}
