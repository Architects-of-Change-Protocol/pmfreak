import { NextRequest, NextResponse } from "next/server";
import { convertTaskDraftToExecutionTask } from "@/lib/execution-tasks/convert-task-draft";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON.", failureClass: "validation_failed" }, { status: 400 });
  }

  const { taskDraftId } = body as Record<string, unknown>;

  if (!taskDraftId || typeof taskDraftId !== "string") {
    return NextResponse.json({ ok: false, error: "taskDraftId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

  const result = await convertTaskDraftToExecutionTask({ taskDraftId });

  if (!result.ok) {
    if (result.failureClass === "unauthenticated") return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: 401 });
    if (result.failureClass === "unauthorized") return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: 403 });
    if (result.failureClass === "not_found") return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: 404 });
    if (result.failureClass === "invalid_transition") return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: 400 });
    if (result.failureClass === "duplicate") return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: 409 });
    return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status: 500 });
  }

  return NextResponse.json({ ok: true, task: result.task }, { status: 201 });
}
