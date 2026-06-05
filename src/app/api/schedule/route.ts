import { NextRequest, NextResponse } from "next/server";
import { getProjectSchedule } from "@/lib/schedule/repository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }

  const result = await getProjectSchedule({ projectId });

  if (!result.ok) {
    const status =
      result.failureClass === "unauthenticated" ? 401 :
      result.failureClass === "unauthorized" ? 403 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    milestones: result.schedule.milestones,
    tasks: result.schedule.tasks,
    dependencies: result.schedule.dependencies,
    health: result.schedule.health,
  });
}
