import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createPmoSignOffPacket, listAgentPmoSignOffPackets } from "@/lib/agents";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const approvalPackId = url.searchParams.get("approvalPackId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const packets = await listAgentPmoSignOffPackets(workspaceId, { approvalPackId, limit });
    return NextResponse.json({ ok: true, data: packets });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId, approvalPackId, simulationReportId, impactSummaryId, draftDiffId, approvalChecklistId, rollbackChecklistId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!changeRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_CHANGE_REQUEST", message: "changeRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const packet = await createPmoSignOffPacket({ workspaceId, changeRequestId, approvalPackId: approvalPackId ?? null, simulationReportId: simulationReportId ?? null, impactSummaryId: impactSummaryId ?? null, draftDiffId: draftDiffId ?? null, approvalChecklistId: approvalChecklistId ?? null, rollbackChecklistId: rollbackChecklistId ?? null, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: packet }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
