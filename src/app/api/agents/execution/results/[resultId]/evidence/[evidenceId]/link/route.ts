import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { linkEvidenceToResult } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

const ROUTE = "/api/agents/execution/results/[resultId]/evidence/[evidenceId]/link";

export async function POST(request: Request, { params }: { params: Promise<{ resultId: string; evidenceId: string }> }) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { resultId, evidenceId } = await params;
    const body = await request.json();
    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const result = await linkEvidenceToResult({ workspaceId, resultId, evidenceId, actorId: body.actorId ?? user.id });
    return NextResponse.json({ ok: true, data: { result } });
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
