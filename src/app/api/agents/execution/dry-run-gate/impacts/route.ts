import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generateDryRunSimulatedImpacts, listAgentPmoDryRunSimulatedImpacts } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const records = await listAgentPmoDryRunSimulatedImpacts(workspaceId, url.searchParams.get("dryRunExecutionId") ?? undefined);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/impacts", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, dryRunRequestId, dryRunExecutionId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!dryRunRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "dryRunRequestId required" } }, { status: 400 });
    if (!dryRunExecutionId) return NextResponse.json({ ok: false, error: { code: "MISSING_EXECUTION_ID", message: "dryRunExecutionId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const impacts = await generateDryRunSimulatedImpacts({ workspaceId, dryRunRequestId, dryRunExecutionId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: impacts }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/impacts", err);
  }
}
