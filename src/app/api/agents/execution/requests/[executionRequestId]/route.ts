import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentExecutionRequestById } from "@/lib/agents";

const ROUTE = "/api/agents/execution/requests/[executionRequestId]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ executionRequestId: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { executionRequestId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const executionRequest = await getAgentExecutionRequestById(workspaceId, executionRequestId);
    if (!executionRequest) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Execution request not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { executionRequest } });
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
