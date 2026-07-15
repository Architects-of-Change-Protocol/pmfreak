import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordPolicyRollbackGateDecision, listAgentPmoPolicyRollbackGateDecisions } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, rollbackGateId, rollbackRequestId, decision, rationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!rollbackGateId) return NextResponse.json({ ok: false, error: { code: "MISSING_GATE_ID", message: "rollbackGateId required" } }, { status: 400 });
    if (!rollbackRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "rollbackRequestId required" } }, { status: 400 });
    if (!decision) return NextResponse.json({ ok: false, error: { code: "MISSING_DECISION", message: "decision required" } }, { status: 400 });
    if (!rationale) return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rationale required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await recordPolicyRollbackGateDecision({ workspaceId, rollbackGateId, rollbackRequestId, decisionType: decision, rationale, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/rollback-gate-decisions", err);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await listAgentPmoPolicyRollbackGateDecisions(workspaceId);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/rollback-gate-decisions", err);
  }
}
