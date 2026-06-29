import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentExecutionLearningSignalById } from "@/lib/agents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ signalId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const { signalId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const signal = await getAgentExecutionLearningSignalById(workspaceId, signalId);
    if (!signal) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Signal not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: signal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
