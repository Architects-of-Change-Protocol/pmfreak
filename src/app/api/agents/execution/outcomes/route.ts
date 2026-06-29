import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createAgentExecutionOutcome,
  listAgentExecutionOutcomes,
  normalizeCreateAgentExecutionOutcomeInput,
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
      outcomeType: url.searchParams.get("outcomeType") ?? undefined,
      matchStatus: url.searchParams.get("matchStatus") ?? undefined,
      confidenceLevel: url.searchParams.get("confidenceLevel") ?? undefined,
      reviewStatus: url.searchParams.get("reviewStatus") ?? undefined,
      reviewRequirement: url.searchParams.get("reviewRequirement") ?? undefined,
      executionRequestId: url.searchParams.get("executionRequestId") ?? undefined,
      finalizationId: url.searchParams.get("finalizationId") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const outcomes = await listAgentExecutionOutcomes(workspaceId, filters as never);
    return NextResponse.json({ ok: true, data: outcomes });
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
    const normalized = normalizeCreateAgentExecutionOutcomeInput({
      workspaceId,
      executionRequestId: body.executionRequestId,
      finalizationId: body.finalizationId ?? null,
      dispatchAttemptId: body.dispatchAttemptId ?? null,
      dispatchGateId: body.dispatchGateId ?? null,
      adapterExecutionId: body.adapterExecutionId ?? null,
      resultId: body.resultId ?? null,
      outcomeType: body.outcomeType ?? undefined,
      intendedOutcomeSummary: body.intendedOutcomeSummary ?? null,
      actualOutcomeSummary: body.actualOutcomeSummary ?? null,
      outcomePayload: body.outcomePayload ?? null,
      createdBy: user.id,
    });
    const outcome = await createAgentExecutionOutcome(normalized);
    return NextResponse.json({ ok: true, data: outcome }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
