import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createGovernancePolicyRollbackPlan,
  listPolicyRollbackPlans,
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
    const plans = await listPolicyRollbackPlans(workspaceId, { limit });
    return NextResponse.json({ ok: true, data: plans });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, changeRequestId, planType, planDescription, affectedPolicyKeys, estimatedRollbackMinutes } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!changeRequestId || !planType) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_FIELDS", message: "changeRequestId and planType required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const plan = await createGovernancePolicyRollbackPlan({
      workspaceId,
      changeRequestId,
      planType,
      planDescription: planDescription ?? undefined,
      affectedPolicyKeys: affectedPolicyKeys ?? [],
      estimatedRollbackMinutes: estimatedRollbackMinutes ?? 30,
      actorId: user.id ?? null,
    });
    return NextResponse.json({ ok: true, data: plan }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
