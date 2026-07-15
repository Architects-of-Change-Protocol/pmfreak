import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { recordDryRunBlocker, listAgentPmoDryRunBlockers } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const records = await listAgentPmoDryRunBlockers(workspaceId, url.searchParams.get("dryRunRequestId") ?? undefined);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/blockers", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, dryRunRequestId, blockerType, severity, summary } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!dryRunRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "dryRunRequestId required" } }, { status: 400 });
    if (!blockerType) return NextResponse.json({ ok: false, error: { code: "MISSING_TYPE", message: "blockerType required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const blocker = await recordDryRunBlocker({ workspaceId, dryRunRequestId, blockerType, severity, summary, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: blocker }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/blockers", err);
  }
}
