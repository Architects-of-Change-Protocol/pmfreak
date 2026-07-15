import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { evaluateImplementationGatePrerequisites, listAgentPmoImplementationGatePrerequisites } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const planningWorkspaceId = url.searchParams.get("planningWorkspaceId") ?? undefined;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const prereqs = await listAgentPmoImplementationGatePrerequisites(workspaceId, { planningWorkspaceId });
    return NextResponse.json({ ok: true, data: prereqs });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/gate-prerequisites", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, planningWorkspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!planningWorkspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PLANNING_WORKSPACE", message: "planningWorkspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const prereqs = await evaluateImplementationGatePrerequisites({ workspaceId, planningWorkspaceId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: prereqs }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/gate-prerequisites", err);
  }
}
