import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generatePolicyDraftDiff } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!changeRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_CHANGE_REQUEST", message: "changeRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const diff = await generatePolicyDraftDiff({ workspaceId, changeRequestId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: diff }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, { status: 500 });
  }
}
