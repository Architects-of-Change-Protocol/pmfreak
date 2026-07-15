import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { archiveLearningSignal } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ signalId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { signalId } = await params;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const signal = await archiveLearningSignal(workspaceId, signalId, user.id);
    if (!signal) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Signal not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: signal });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/signals/[signalId]/archive", err);
  }
}
