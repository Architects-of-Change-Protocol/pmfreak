import { NextRequest, NextResponse } from "next/server";
import { createProjectMilestone } from "@/lib/schedule/milestones";
import type { ProjectMilestoneType } from "@/lib/db/database-contract";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const title = typeof body.title === "string" ? body.title : null;

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ ok: false, error: "title is required." }, { status: 400 });
  }

  const result = await createProjectMilestone({
    projectId,
    title,
    description: typeof body.description === "string" ? body.description : null,
    milestoneType: typeof body.milestoneType === "string" ? body.milestoneType as ProjectMilestoneType : undefined,
    targetDate: typeof body.targetDate === "string" ? body.targetDate : null,
    baselineDate: typeof body.baselineDate === "string" ? body.baselineDate : null,
    forecastDate: typeof body.forecastDate === "string" ? body.forecastDate : null,
    sourceType: typeof body.sourceType === "string" ? body.sourceType : undefined,
    sourcePayload: typeof body.sourcePayload === "object" && body.sourcePayload !== null
      ? body.sourcePayload as Record<string, unknown>
      : undefined,
  });

  if (!result.ok) {
    const status =
      result.failureClass === "unauthenticated" ? 401 :
      result.failureClass === "unauthorized" ? 403 :
      result.failureClass === "validation_failed" ? 400 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, milestone: result.milestone }, { status: 201 });
}
