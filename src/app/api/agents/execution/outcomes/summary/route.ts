import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { buildExecutionOutcomeSummary } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const outcomeId = url.searchParams.get("outcomeId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!outcomeId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_OUTCOME", message: "outcomeId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const summary = await buildExecutionOutcomeSummary(workspaceId, outcomeId);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/outcomes/summary", err);
  }
}
