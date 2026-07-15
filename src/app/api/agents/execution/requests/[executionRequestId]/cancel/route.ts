import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { cancelAgentExecutionRequest } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

const ROUTE = "/api/agents/execution/requests/[executionRequestId]/cancel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ executionRequestId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { executionRequestId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const executionRequest = await cancelAgentExecutionRequest({
      workspaceId,
      executionRequestId,
      actorId: body.actorId ?? user.id,
      message: body.message ?? null,
    });
    return NextResponse.json({ ok: true, data: { executionRequest } });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      if (String(error.metadata.reason) === "unauthorized") {
        return denyResponse({ status: 401, routeId: ROUTE, message: "Unauthorized", reason: "unauthorized" });
      }
      return denyFromAccessError(error, { status: 403, routeId: ROUTE, message: "Forbidden" });
    }
    return safeInternalErrorResponse(ROUTE, error);
  }
}
