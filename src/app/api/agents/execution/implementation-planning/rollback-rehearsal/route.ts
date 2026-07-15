import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createRollbackRehearsalPlan, listAgentPmoRollbackRehearsalPlans } from "@/lib/agents";
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
    const plans = await listAgentPmoRollbackRehearsalPlans(workspaceId, { planningWorkspaceId });
    return NextResponse.json({ ok: true, data: plans });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/rollback-rehearsal", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, planningWorkspaceId, rollbackPlanId, rehearsalType, rehearsalSummary, verificationSteps, expectedEvidence } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!planningWorkspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PLANNING_WORKSPACE", message: "planningWorkspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const plan = await createRollbackRehearsalPlan({ workspaceId, planningWorkspaceId, rollbackPlanId: rollbackPlanId ?? null, rehearsalType: rehearsalType ?? "tabletop", rehearsalSummary: rehearsalSummary ?? "", verificationSteps: verificationSteps ?? [], expectedEvidence: expectedEvidence ?? [], actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: plan }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/rollback-rehearsal", err);
  }
}
