import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { evaluateProductionReadinessGate, listAgentPmoProductionReadinessGates } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!body.hardeningRunId) return NextResponse.json({ ok: false, error: { code: "MISSING_FIELD", message: "hardeningRunId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    const gate = await evaluateProductionReadinessGate(body.workspaceId, body.hardeningRunId);
    return NextResponse.json({ ok: true, data: gate }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/runtime-hardening/readiness-gates", err);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const records = await listAgentPmoProductionReadinessGates(workspaceId);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/runtime-hardening/readiness-gates", err);
  }
}
