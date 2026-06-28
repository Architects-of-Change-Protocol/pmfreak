import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { denyFromAccessError, denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { getAgentToolAdapterByKey } from "@/lib/agents";

const ROUTE = "/api/agents/execution/adapters/[adapterKey]";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ adapterKey: string }> },
) {
  try {
    await requireAuthenticatedUser();
    const { adapterKey } = await params;

    const adapter = getAgentToolAdapterByKey(adapterKey);
    if (!adapter) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Adapter not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { adapter } });
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
