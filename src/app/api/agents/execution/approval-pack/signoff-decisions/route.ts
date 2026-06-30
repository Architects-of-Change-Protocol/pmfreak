import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordPmoSignOffDecision } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, signOffPacketId, approvalPackId, decision, rationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!signOffPacketId) return NextResponse.json({ ok: false, error: { code: "MISSING_PACKET", message: "signOffPacketId required" } }, { status: 400 });
    if (!decision) return NextResponse.json({ ok: false, error: { code: "MISSING_DECISION", message: "decision required" } }, { status: 400 });
    if (!rationale) return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rationale required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await recordPmoSignOffDecision({ workspaceId, signOffPacketId, approvalPackId: approvalPackId ?? null, decisionType: decision, rationale, decidedBy: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
