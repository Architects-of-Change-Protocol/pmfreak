import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoRuntimeHardeningBlockerStatus } from "@/lib/agents";

export async function POST(request: Request, { params }: { params: Promise<{ blockerId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { blockerId } = await params;
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    const updated = await updateAgentPmoRuntimeHardeningBlockerStatus(blockerId, body.status);
    if (!updated) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
