import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generatePolicyActivationExport, listAgentPmoPolicyActivationExports } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, activationRequestId, exportFormat } = body;
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!activationRequestId) return NextResponse.json({ ok: false, error: { code: "MISSING_REQUEST_ID", message: "activationRequestId required" } }, { status: 400 });
    if (!exportFormat) return NextResponse.json({ ok: false, error: { code: "MISSING_FORMAT", message: "exportFormat required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await generatePolicyActivationExport({ workspaceId, activationRequestId, exportFormat, generatedBy: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/exports", err);
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const result = await listAgentPmoPolicyActivationExports(workspaceId);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/policy-activation/exports", err);
  }
}
