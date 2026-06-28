import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { checkAgentToolEligibility } from "@/lib/agents";

const ROUTE = "/api/agents/tools/[toolKey]/eligibility";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ toolKey: string }> }
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { toolKey } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!body.agentType) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_AGENT_TYPE", message: "agentType required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await checkAgentToolEligibility({
      workspaceId,
      agentId: body.agentId,
      agentType: body.agentType,
      toolKey,
      grantedPermissions: body.grantedPermissions,
      allowApprovalRequiredTools: body.allowApprovalRequiredTools ?? false,
    });

    return NextResponse.json({ ok: true, data: { eligibility: result } });
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
