import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getDefaultAgentToolAdapters } from "@/lib/agents";

const ROUTE = "/api/agents/execution/adapters";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (workspaceId) {
      await requireWorkspaceMember(workspaceId);
    }

    const toolKey = url.searchParams.get("tool_key") ?? undefined;
    const executionMode = url.searchParams.get("execution_mode") ?? undefined;

    let adapters = getDefaultAgentToolAdapters();
    if (toolKey) {
      adapters = adapters.filter((a) => a.supportedToolKeys.includes(toolKey));
    }
    if (executionMode) {
      adapters = adapters.filter((a) => a.supportedExecutionModes.includes(executionMode as never));
    }

    return NextResponse.json({ ok: true, data: { adapters } });
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
