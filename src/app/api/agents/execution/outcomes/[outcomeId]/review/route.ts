import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createHumanOutcomeReview, determineHumanOutcomeReview } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ outcomeId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const { outcomeId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await determineHumanOutcomeReview(workspaceId, outcomeId);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/outcomes/[outcomeId]/review", err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ outcomeId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { outcomeId } = await params;
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const result = await createHumanOutcomeReview({
      workspaceId,
      outcomeId,
      priority: body.priority ?? undefined,
      title: body.title ?? undefined,
      summary: body.summary ?? null,
      dueAt: body.dueAt ?? null,
      createdBy: user.id,
    });
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/outcomes/[outcomeId]/review", err);
  }
}
