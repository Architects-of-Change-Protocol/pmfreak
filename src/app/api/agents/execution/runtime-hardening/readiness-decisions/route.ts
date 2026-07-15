import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordAgentPmoProductionReadinessDecision, listAgentPmoProductionReadinessDecisions } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    const record = await recordAgentPmoProductionReadinessDecision(body);
    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/runtime-hardening/readiness-decisions", err);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const gateId = searchParams.get("gateId") ?? undefined;
    const records = await listAgentPmoProductionReadinessDecisions(workspaceId, gateId);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/runtime-hardening/readiness-decisions", err);
  }
}
