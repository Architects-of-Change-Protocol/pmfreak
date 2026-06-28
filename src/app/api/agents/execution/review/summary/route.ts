import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getUserWorkspaces } from "@/lib/workspaces";
import { buildReviewInboxSummary } from "@/lib/agents";

const ROUTE = "/api/agents/execution/review/summary";

export async function GET(request: Request) {
  try {
    const { user: _user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    let workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      const workspaces = await getUserWorkspaces(_user.id);
      workspaceId = workspaces[0]?.id ?? null;
    }
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const summary = await buildReviewInboxSummary(workspaceId);
    return NextResponse.json({ ok: true, data: { summary } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    throw error;
  }
}
