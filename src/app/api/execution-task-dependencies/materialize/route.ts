import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materializeInferredExecutionTaskDependencies } from "@/lib/execution-tasks/dependencies/materialize-inferred-dependencies";
import type { ProjectRow } from "@/lib/db/database-contract";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let userId: string;
  try {
    const { user } = await requireAuthenticatedUser();
    userId = user.id;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId || typeof projectId !== "string") {
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
  const { data: project } = await supabase
    .from("projects")
    .select("id,user_id,workspace_id,name,description,status,onboarding_payload,created_at,updated_at")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const result = await materializeInferredExecutionTaskDependencies({
    projectId,
    workspaceId: project.workspace_id,
    actorUserId: userId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: result.inserted, skipped: result.skipped });
}
