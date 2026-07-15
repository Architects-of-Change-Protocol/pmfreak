import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  generateGovernanceSimulationReport,
  listAgentPmoSimulationReports,
} from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const changeRequestId = url.searchParams.get("changeRequestId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const reports = await listAgentPmoSimulationReports(workspaceId, { changeRequestId, limit });
    return NextResponse.json({ ok: true, data: reports });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/reports", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!changeRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_CHANGE_REQUEST", message: "changeRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const report = await generateGovernanceSimulationReport({ workspaceId, changeRequestId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: report }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/approval-pack/reports", err);
  }
}
