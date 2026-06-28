import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentToolRequestById } from "@/lib/agents";

const ROUTE = "/api/agents/tool-requests/[requestId]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    await requireAuthenticatedUser();
    const { requestId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } },
        { status: 400 }
      );
    }
    await requireWorkspaceMember(workspaceId);

    const toolRequest = await getAgentToolRequestById(workspaceId, requestId);
    if (!toolRequest) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Request not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: { request: toolRequest } });
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
