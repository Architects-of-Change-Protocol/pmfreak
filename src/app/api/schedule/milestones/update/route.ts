import { NextRequest, NextResponse } from "next/server";
import { updateProjectMilestone, completeProjectMilestone, cancelProjectMilestone } from "@/lib/schedule/milestones";
import type { ProjectMilestoneStatus } from "@/lib/db/database-contract";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const milestoneId = typeof body.milestoneId === "string" ? body.milestoneId : null;
  if (!milestoneId) {
    return NextResponse.json({ ok: false, error: "milestoneId is required." }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status as ProjectMilestoneStatus : undefined;

  // Shortcut for complete/cancel
  if (status === "completed") {
    const result = await completeProjectMilestone({ milestoneId });
    if (!result.ok) {
      const code = result.failureClass === "unauthenticated" ? 401 : result.failureClass === "unauthorized" ? 403 : result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ ok: false, error: result.error }, { status: code });
    }
    return NextResponse.json({ ok: true, milestone: result.milestone });
  }

  if (status === "cancelled") {
    const result = await cancelProjectMilestone({ milestoneId });
    if (!result.ok) {
      const code = result.failureClass === "unauthenticated" ? 401 : result.failureClass === "unauthorized" ? 403 : result.failureClass === "not_found" ? 404 : 500;
      return NextResponse.json({ ok: false, error: result.error }, { status: code });
    }
    return NextResponse.json({ ok: true, milestone: result.milestone });
  }

  const result = await updateProjectMilestone({
    milestoneId,
    title: typeof body.title === "string" ? body.title : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    status,
    targetDate: typeof body.targetDate === "string" ? body.targetDate : undefined,
    baselineDate: typeof body.baselineDate === "string" ? body.baselineDate : undefined,
    forecastDate: typeof body.forecastDate === "string" ? body.forecastDate : undefined,
  });

  if (!result.ok) {
    const code =
      result.failureClass === "unauthenticated" ? 401 :
      result.failureClass === "unauthorized" ? 403 :
      result.failureClass === "not_found" ? 404 :
      result.failureClass === "validation_failed" ? 400 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status: code });
  }

  return NextResponse.json({ ok: true, milestone: result.milestone });
}
