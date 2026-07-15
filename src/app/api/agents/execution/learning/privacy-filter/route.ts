import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { runLearningPrivacyFilter } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const filterRecord = await runLearningPrivacyFilter({
      workspaceId,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      candidateSignalType: body.candidateSignalType,
      signalValue: body.signalValue ?? "",
      signalPayload: body.signalPayload ?? null,
    });
    return NextResponse.json({ ok: true, data: filterRecord }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/privacy-filter", err);
  }
}
