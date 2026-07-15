import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { runDryRunPreflightValidation, listAgentPmoDryRunPreflightValidations } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const dryRunRequestId = url.searchParams.get("dryRunRequestId") ?? undefined;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const records = await listAgentPmoDryRunPreflightValidations(workspaceId, dryRunRequestId);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/preflight", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, dryRunRequestId } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!dryRunRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "dryRunRequestId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const preflight = await runDryRunPreflightValidation({ workspaceId, dryRunRequestId, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: preflight }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/dry-run-gate/preflight", err);
  }
}
