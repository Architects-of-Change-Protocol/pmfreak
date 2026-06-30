import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createDryRunExecutionRequestFromPlanningWorkspace } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, planningWorkspaceId, requestReason } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!planningWorkspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_PLANNING_WORKSPACE", message: "planningWorkspaceId required" } }, { status: 400 });
    if (!requestReason) return NextResponse.json({ ok: false, error: { code: "MISSING_REASON", message: "requestReason required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const req = await createDryRunExecutionRequestFromPlanningWorkspace({
      workspaceId,
      planningWorkspaceId,
      approvalPackId: body.approvalPackId ?? null,
      changeRequestId: body.changeRequestId ?? null,
      requestReason,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: req }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
