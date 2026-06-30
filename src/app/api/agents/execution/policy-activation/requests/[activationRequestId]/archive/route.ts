import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archivePolicyActivationRequest } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ activationRequestId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { activationRequestId } = await params;
    const body = await request.json();
    const { workspaceId, rationale } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await archivePolicyActivationRequest({
      workspaceId,
      activationRequestId,
      rationale: rationale ?? "Archived by operator.",
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
