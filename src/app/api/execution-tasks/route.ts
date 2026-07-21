import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createExecutionTaskDirect } from "@/lib/execution-tasks/create-execution-task";
import type { ExecutionTaskRow } from "@/lib/db/database-contract";

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated.", failureClass: "unauthenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required.", failureClass: "validation_failed" }, { status: 400 });
  }

  try {
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied.", failureClass: "unauthorized" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization check failed.", failureClass: "unauthorized" }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("execution_tasks")
    .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
    .eq("project_id", projectId);

  const status = searchParams.get("status");
  if (status) query = query.eq("status", status);

  const owner = searchParams.get("owner");
  if (owner) query = query.eq("owner_user_id", owner);

  const priority = searchParams.get("priority");
  if (priority) query = query.eq("priority", priority);

  const { data, error } = await query.returns<ExecutionTaskRow[]>();

  if (error) {
    return NextResponse.json({ ok: false, error: "Unable to load execution tasks.", failureClass: "persistence_failed" }, { status: 500 });
  }

  const tasks = (data ?? []).sort((a, b) => {
    const pd = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (pd !== 0) return pd;
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  return NextResponse.json({ ok: true, tasks });
}

const FAILURE_STATUS: Record<string, number> = {
  unauthenticated: 401,
  unauthorized: 403,
  not_found: 404,
  validation_failed: 400,
  invalid_state: 409,
  persistence_failed: 500,
};

/**
 * Direct ("Quick Add Task") task creation — writes the same canonical
 * execution_tasks row the RAID → Recommended Action → Task Draft conversion
 * path writes, without requiring that chain. See
 * src/lib/execution-tasks/create-execution-task.ts.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON.", failureClass: "validation_failed" }, { status: 400 });
  }

  const result = await createExecutionTaskDirect(body);

  if (!result.ok) {
    const status = FAILURE_STATUS[result.failureClass] ?? 500;
    return NextResponse.json(
      { ok: false, error: result.error, failureClass: result.failureClass, fieldErrors: result.fieldErrors },
      { status },
    );
  }

  return NextResponse.json({ ok: true, task: result.task }, { status: 201 });
}
