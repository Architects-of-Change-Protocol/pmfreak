import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentExecutionGovernanceFeedback, generateGovernanceFeedbackFromSignals } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const filters = {
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const feedback = await listAgentExecutionGovernanceFeedback(workspaceId, filters as never);
    return NextResponse.json({ ok: true, data: feedback });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/governance-feedback", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const feedbackRecords = await generateGovernanceFeedbackFromSignals({
      workspaceId,
      sourceSignalIds: body.sourceSignalIds ?? [],
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, data: feedbackRecords }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/governance-feedback", err);
  }
}
