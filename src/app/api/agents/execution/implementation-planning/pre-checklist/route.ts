import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generatePreImplementationChecklist } from "@/lib/agents";
import { listAgentPmoPreImplementationChecklistItems } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    const checklistId = url.searchParams.get("checklistId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    if (checklistId) {
      const items = await listAgentPmoPreImplementationChecklistItems(workspaceId, checklistId);
      return NextResponse.json({ ok: true, data: items });
    }
    return NextResponse.json({ ok: true, data: [] });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/pre-checklist", err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, planningWorkspaceId, approvalPackId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!planningWorkspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_PLANNING_WORKSPACE", message: "planningWorkspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await generatePreImplementationChecklist({ workspaceId, planningWorkspaceId, approvalPackId: approvalPackId ?? null, actorId: user.id ?? null });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/implementation-planning/pre-checklist", err);
  }
}
