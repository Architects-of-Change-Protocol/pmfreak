import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { proposeChangeWindowPlan, listAgentPmoChangeWindowPlans } from "@/lib/agents";

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
    const plans = await listAgentPmoChangeWindowPlans(workspaceId, { planningWorkspaceId });
    return NextResponse.json({ ok: true, data: plans });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, planningWorkspaceId, windowType, changeRequestId, proposedStartAt, proposedEndAt, timezone, businessImpactEstimate, operationalConstraints } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!planningWorkspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PLANNING_WORKSPACE", message: "planningWorkspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const plan = await proposeChangeWindowPlan({ workspaceId, planningWorkspaceId, windowType: windowType ?? "standard", changeRequestId: changeRequestId ?? null, proposedStartAt: proposedStartAt ?? null, proposedEndAt: proposedEndAt ?? null, timezone: timezone ?? null, businessImpactEstimate: businessImpactEstimate ?? null, operationalConstraints: operationalConstraints ?? null, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: plan }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
