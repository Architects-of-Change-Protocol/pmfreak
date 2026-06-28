import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentToolAdapterExecutionById } from "@/lib/agents";

const ROUTE = "/api/agents/execution/adapter-executions/[adapterExecutionId]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ adapterExecutionId: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { adapterExecutionId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const execution = await getAgentToolAdapterExecutionById(workspaceId, adapterExecutionId);
    if (!execution) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Adapter execution not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { execution } });
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
