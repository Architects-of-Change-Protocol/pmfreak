import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { cancelAgentToolRequest } from "@/lib/agents";

const ROUTE = "/api/agents/tool-requests/[requestId]/cancel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { requestId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } },
        { status: 400 }
      );
    }
    await requireWorkspaceMember(workspaceId);

    const result = await cancelAgentToolRequest(workspaceId, requestId, body.cancelledBy ?? user.id);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "CANCEL_FAILED", message: result.error } },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, data: { request: result.request } });
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
