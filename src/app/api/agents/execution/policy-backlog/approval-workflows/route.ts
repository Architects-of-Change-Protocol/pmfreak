import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createPolicyApprovalWorkflowForRequest,
  recordPolicyApprovalDecisionForWorkflow,
  listPolicyApprovalWorkflows,
} from "@/lib/agents";

export async function GET(request: Request) {
  try {
    void (await requireAuthenticatedUser());
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;
    const workflows = await listPolicyApprovalWorkflows(workspaceId, { limit });
    return NextResponse.json({ ok: true, data: workflows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId, action, workflowId, stage, decisionType, decisionNote } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    if (action === "record_decision") {
      if (!workflowId || !stage || !decisionType) {
        return NextResponse.json({ ok: false, error: { code: "MISSING_FIELDS", message: "workflowId, stage, decisionType required for decision" } }, { status: 400 });
      }
      const decision = await recordPolicyApprovalDecisionForWorkflow({
        workspaceId,
        workflowId,
        stage,
        decisionType,
        decisionNote: decisionNote ?? null,
        decidedBy: user.id ?? null,
      });
      return NextResponse.json({ ok: true, data: decision }, { status: 201 });
    }

    if (!changeRequestId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_CHANGE_REQUEST", message: "changeRequestId required" } }, { status: 400 });
    }
    const workflow = await createPolicyApprovalWorkflowForRequest({
      workspaceId,
      changeRequestId,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: workflow }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
