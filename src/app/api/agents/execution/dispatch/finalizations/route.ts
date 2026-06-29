import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createAgentExecutionFinalization,
  listAgentExecutionFinalizations,
  normalizeCreateAgentExecutionFinalizationInput,
} from "@/lib/agents";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const filters = {
      status: url.searchParams.get("status") ?? undefined,
      readiness: url.searchParams.get("readiness") ?? undefined,
      executionRequestId: url.searchParams.get("executionRequestId") ?? undefined,
      actionConversionId: url.searchParams.get("actionConversionId") ?? undefined,
      selectedAdapterKey: url.searchParams.get("selectedAdapterKey") ?? undefined,
      confirmationStatus: url.searchParams.get("confirmationStatus") ?? undefined,
      riskLevel: url.searchParams.get("riskLevel") as "low" | "medium" | "high" | "critical" | undefined ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const finalizations = await listAgentExecutionFinalizations(workspaceId, filters as never);
    return NextResponse.json({ ok: true, data: finalizations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const normalized = normalizeCreateAgentExecutionFinalizationInput({
      workspaceId,
      executionRequestId: body.executionRequestId,
      actionConversionId: body.actionConversionId ?? null,
      createdBy: user.id,
    });
    const finalization = await createAgentExecutionFinalization(normalized);
    return NextResponse.json({ ok: true, data: finalization }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
