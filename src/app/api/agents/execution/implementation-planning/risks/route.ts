import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { registerImplementationRisk, listAgentPmoImplementationRisks } from "@/lib/agents";
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
    const risks = await listAgentPmoImplementationRisks(workspaceId, { planningWorkspaceId });
    return NextResponse.json({ ok: true, data: risks });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/risks", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, planningWorkspaceId, riskType, severity, riskSummary, mitigationSummary, ownerRole } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!planningWorkspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PLANNING_WORKSPACE", message: "planningWorkspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const risk = await registerImplementationRisk({ workspaceId, planningWorkspaceId, riskType: riskType ?? "operational_risk", severity: severity ?? "medium", riskSummary: riskSummary ?? "", mitigationSummary: mitigationSummary ?? null, ownerRole: ownerRole ?? null, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: risk }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/risks", err);
  }
}
