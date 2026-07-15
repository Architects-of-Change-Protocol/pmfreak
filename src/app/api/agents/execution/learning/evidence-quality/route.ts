import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generateEvidenceQualitySignals, listAgentExecutionLearningSignals } from "@/lib/agents";
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
    const signals = await listAgentExecutionLearningSignals(workspaceId, { status: "active", limit: 100 });
    const evidenceSignals = await generateEvidenceQualitySignals(workspaceId, signals);
    return NextResponse.json({ ok: true, data: evidenceSignals }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/learning/evidence-quality", err);
  }
}
