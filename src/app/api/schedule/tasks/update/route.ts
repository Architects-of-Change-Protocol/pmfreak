import { NextRequest, NextResponse } from "next/server";
import { updateExecutionTaskSchedule } from "@/lib/schedule/task-schedule";
import type { TaskScheduleStatus } from "@/lib/db/database-contract";

const VALID_SCHEDULE_STATUSES: TaskScheduleStatus[] = [
  "unscheduled", "scheduled", "at_risk", "delayed", "completed", "cancelled",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const taskId = typeof body.taskId === "string" ? body.taskId : null;
  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required." }, { status: 400 });
  }

  const scheduleStatus = typeof body.scheduleStatus === "string"
    ? body.scheduleStatus as TaskScheduleStatus
    : undefined;

  if (scheduleStatus && !VALID_SCHEDULE_STATUSES.includes(scheduleStatus)) {
    return NextResponse.json({ ok: false, error: `Invalid scheduleStatus: ${scheduleStatus}` }, { status: 400 });
  }

  const result = await updateExecutionTaskSchedule({
    taskId,
    plannedStartDate: typeof body.plannedStartDate === "string" ? body.plannedStartDate : body.plannedStartDate === null ? null : undefined,
    plannedFinishDate: typeof body.plannedFinishDate === "string" ? body.plannedFinishDate : body.plannedFinishDate === null ? null : undefined,
    baselineStartDate: typeof body.baselineStartDate === "string" ? body.baselineStartDate : body.baselineStartDate === null ? null : undefined,
    baselineFinishDate: typeof body.baselineFinishDate === "string" ? body.baselineFinishDate : body.baselineFinishDate === null ? null : undefined,
    forecastStartDate: typeof body.forecastStartDate === "string" ? body.forecastStartDate : body.forecastStartDate === null ? null : undefined,
    forecastFinishDate: typeof body.forecastFinishDate === "string" ? body.forecastFinishDate : body.forecastFinishDate === null ? null : undefined,
    milestoneId: typeof body.milestoneId === "string" ? body.milestoneId : body.milestoneId === null ? null : undefined,
    scheduleStatus,
    scheduleConfidence: typeof body.scheduleConfidence === "number" ? body.scheduleConfidence : undefined,
  });

  if (!result.ok) {
    const code =
      result.failureClass === "unauthenticated" ? 401 :
      result.failureClass === "unauthorized" ? 403 :
      result.failureClass === "not_found" ? 404 :
      result.failureClass === "validation_failed" ? 400 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status: code });
  }

  return NextResponse.json({ ok: true, task: result.task });
}
