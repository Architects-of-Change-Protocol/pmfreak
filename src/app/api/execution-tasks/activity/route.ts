import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import type { ExecutionTaskEventRow, ExecutionTaskRow } from "@/lib/db/database-contract";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ ok: false, error: "taskId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: task, error: taskError } = await supabase
    .from("execution_tasks")
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .eq("id", taskId)
    .maybeSingle<ExecutionTaskRow>();

  if (taskError) {
    return NextResponse.json({ ok: false, error: "Unable to load task.", failureClass: "persistence_failed" }, { status: 500 });
  }
  if (!task) {
    return NextResponse.json({ ok: false, error: "Task not found.", failureClass: "not_found" }, { status: 404 });
  }

  try {
    await requireProjectAccess(task.project_id, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied.", failureClass: "unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization check failed.", failureClass: "unauthorized" }, { status: 403 });
  }

  const { data: events, error: eventsError } = await supabase
    .from("execution_task_events")
    .select("id,workspace_id,project_id,task_id,event_type,event_payload,actor_user_id,created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .returns<ExecutionTaskEventRow[]>();

  if (eventsError) {
    return NextResponse.json({ ok: false, error: "Unable to load activity.", failureClass: "persistence_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, activity: events ?? [] });
}
