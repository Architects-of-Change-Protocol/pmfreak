import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import type { ExecutionTaskRow, ExecutionTaskDependencyRow } from "@/lib/db/database-contract";
import { buildExecutionTaskGraph, getExecutionNetworkSummary } from "@/lib/execution-tasks/dependencies/graph";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }

  try {
    await requireProjectAccess(projectId, "read");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization failed." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  const [tasksResult, depsResult] = await Promise.all([
    supabase
      .from("execution_tasks")
      .select("id,workspace_id,project_id,task_draft_id,recommended_action_id,raid_item_id,title,description,status,priority,owner_user_id,owner_name,start_date,due_date,completed_at,progress_percent,acceptance_criteria,checklist,confidence_score,source_payload,created_by,created_at,updated_at")
      .eq("project_id", projectId),
    supabase
      .from("execution_task_dependencies")
      .select("id,workspace_id,project_id,predecessor_task_id,successor_task_id,dependency_type,status,lag_days,reason,source_type,source_payload,confidence_score,created_by,created_at,updated_at")
      .eq("project_id", projectId),
  ]);

  if (tasksResult.error || depsResult.error) {
    return NextResponse.json({ ok: false, error: "Unable to load graph data." }, { status: 500 });
  }

  const tasks = (tasksResult.data ?? []) as ExecutionTaskRow[];
  const dependencies = (depsResult.data ?? []) as ExecutionTaskDependencyRow[];

  const graph = buildExecutionTaskGraph(tasks, dependencies);
  const graphSummary = getExecutionNetworkSummary(graph, dependencies);

  return NextResponse.json({ ok: true, tasks, dependencies, graphSummary });
}
