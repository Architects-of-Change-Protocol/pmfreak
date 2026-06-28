import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { failAgentExecution } from "@/lib/agents";

const ROUTE = "/api/agents/execution/requests/[executionRequestId]/fail";

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
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const executionRequest = await failAgentExecution({
      workspaceId,
      executionRequestId,
      errorCode: body.errorCode ?? null,
      errorMessage: body.errorMessage ?? null,
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
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
