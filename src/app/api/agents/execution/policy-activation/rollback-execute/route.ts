import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { executePolicyRollback } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, rollbackRequestId, rollbackRationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!rollbackRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "rollbackRequestId required" } }, { status: 400 });
    if (!rollbackRationale) return NextResponse.json({ ok: false, error: { code: "MISSING_RATIONALE", message: "rollbackRationale required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await executePolicyRollback({ workspaceId, rollbackRequestId, rollbackRationale, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
