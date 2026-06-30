import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoImplementationPlanningWorkspaceStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ planningWorkspaceId: string }> }) {
  try {
    void (await requireAuthenticatedUser());
    const { planningWorkspaceId } = await params;
    const body = await request.json();
    const { workspaceId, status } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_STATUS", message: "status required" } }, { status: 400 });
    }
    const VALID_STATUSES = ["created", "planning", "under_review", "changes_requested", "approved_for_dry_run_planning", "blocked", "archived"];
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_STATUS", message: `status must be one of: ${VALID_STATUSES.join(", ")}` } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const updated = await updateAgentPmoImplementationPlanningWorkspaceStatus(workspaceId, planningWorkspaceId, status);
    if (!updated) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Planning workspace not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
