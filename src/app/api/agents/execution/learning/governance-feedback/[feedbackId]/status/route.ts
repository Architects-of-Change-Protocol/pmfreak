import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentExecutionGovernanceFeedbackStatus } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ feedbackId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { feedbackId } = await params;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const updated = await updateAgentExecutionGovernanceFeedbackStatus(workspaceId, feedbackId, body.status, user.id);
    if (!updated) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Feedback not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/governance-feedback/[feedbackId]/status", err);
  }
}
