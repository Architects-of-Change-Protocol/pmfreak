import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  listAgentExecutionLearningSignals,
  createPrivacySafeLearningSignal,
  normalizeCreateAgentExecutionLearningSignalInput,
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
      signalType: url.searchParams.get("signalType") ?? undefined,
      signalCategory: url.searchParams.get("signalCategory") ?? undefined,
      sourceType: url.searchParams.get("sourceType") ?? undefined,
      outcomeId: url.searchParams.get("outcomeId") ?? undefined,
      adapterKey: url.searchParams.get("adapterKey") ?? undefined,
      actionType: url.searchParams.get("actionType") ?? undefined,
      privacyClassification: url.searchParams.get("privacyClassification") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    const signals = await listAgentExecutionLearningSignals(workspaceId, filters as never);
    return NextResponse.json({ ok: true, data: signals });
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
    const normalized = normalizeCreateAgentExecutionLearningSignalInput({
      workspaceId,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      outcomeId: body.outcomeId ?? null,
      reviewId: body.reviewId ?? null,
      decisionId: body.decisionId ?? null,
      dispatchAttemptId: body.dispatchAttemptId ?? null,
      adapterKey: body.adapterKey ?? null,
      toolKey: body.toolKey ?? null,
      actionType: body.actionType ?? null,
      signalType: body.signalType,
      signalCategory: body.signalCategory,
      signalValue: body.signalValue,
      signalWeight: body.signalWeight ?? undefined,
      confidenceScore: body.confidenceScore ?? undefined,
      signalPayload: body.signalPayload ?? null,
      createdBy: user.id,
    });
    const signal = await createPrivacySafeLearningSignal(normalized);
    if (!signal) {
      return NextResponse.json({ ok: false, error: { code: "PRIVACY_BLOCKED", message: "Signal blocked by privacy filter" } }, { status: 422 });
    }
    return NextResponse.json({ ok: true, data: signal }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
