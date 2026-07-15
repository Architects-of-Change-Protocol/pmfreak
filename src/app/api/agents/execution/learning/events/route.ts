import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentExecutionLearningEvents } from "@/lib/agents";
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
      signalId: url.searchParams.get("signalId") ?? undefined,
      extractionId: url.searchParams.get("extractionId") ?? undefined,
      feedbackId: url.searchParams.get("feedbackId") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const events = await listAgentExecutionLearningEvents(workspaceId, filters);
    return NextResponse.json({ ok: true, data: events });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/events", err);
  }
}
