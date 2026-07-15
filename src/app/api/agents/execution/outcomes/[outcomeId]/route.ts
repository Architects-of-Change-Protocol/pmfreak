import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentExecutionOutcomeById } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ outcomeId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const { outcomeId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const outcome = await getAgentExecutionOutcomeById(workspaceId, outcomeId);
    if (!outcome) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Outcome not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: outcome });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/outcomes/[outcomeId]", err);
  }
}
