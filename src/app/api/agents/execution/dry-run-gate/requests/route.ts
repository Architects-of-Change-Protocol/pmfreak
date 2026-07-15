import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentPmoDryRunExecutionRequests, createDryRunExecutionRequestFromPlanningWorkspace } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const requests = await listAgentPmoDryRunExecutionRequests(workspaceId, { status: status as never, limit });
    return NextResponse.json({ ok: true, data: requests });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/requests", err);
  }
}

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
      workspaceId, planningWorkspaceId, requestReason,
      approvalPackId: body.approvalPackId ?? null,
      changeRequestId: body.changeRequestId ?? null,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: req }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/requests", err);
  }
}
