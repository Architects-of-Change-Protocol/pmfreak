import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listAgentPmoDryRunChangeSetItems } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const records = await listAgentPmoDryRunChangeSetItems(workspaceId, url.searchParams.get("changeSetId") ?? undefined);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/change-set-items", err);
  }
}
