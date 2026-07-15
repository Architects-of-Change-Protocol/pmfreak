import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archiveImplementationPlanningWorkspace } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ planningWorkspaceId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { planningWorkspaceId } = await params;
    const body = await request.json();
    const { workspaceId, rationale } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!rationale) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rationale required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const workspace = await archiveImplementationPlanningWorkspace({
      workspaceId,
      planningWorkspaceId,
      rationale,
      actorId: user.id ?? null,
    });
    if (!workspace) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Planning workspace not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: workspace });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/workspaces/[planningWorkspaceId]/archive", err);
  }
}
