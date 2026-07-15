import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { buildExecutionLearningSummary } from "@/lib/agents";
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
    const summary = await buildExecutionLearningSummary(workspaceId);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/summary", err);
  }
}
