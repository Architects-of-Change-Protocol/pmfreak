import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceRole } from "@/lib/security/server-authorization";
import { revokeAgentToolApproval } from "@/lib/agents";

const ROUTE = "/api/agents/tool-requests/[requestId]/revoke";

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
    await requireWorkspaceRole(workspaceId, ["owner", "admin"]);

    const result = await revokeAgentToolApproval(
      workspaceId,
      requestId,
      body.revokedBy ?? user.id,
      body.revocationNote ?? null
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "REVOKE_FAILED", message: result.error } },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, data: { approval: result.approval } });
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
