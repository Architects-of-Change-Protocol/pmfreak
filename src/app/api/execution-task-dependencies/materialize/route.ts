import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materializeInferredExecutionTaskDependencies } from "@/lib/execution-tasks/dependencies/materialize-inferred-dependencies";
import type { ProjectRow } from "@/lib/db/database-contract";

export type MaterializeExecutionTaskDependenciesDeps = {
  requireAuthenticatedUser: typeof requireAuthenticatedUser;
  requireProjectAccess: typeof requireProjectAccess;
  createSupabaseServerClient: typeof createSupabaseServerClient;
  materializeInferredExecutionTaskDependencies: typeof materializeInferredExecutionTaskDependencies;
};

const defaultDeps: MaterializeExecutionTaskDependenciesDeps = {
  requireAuthenticatedUser,
  requireProjectAccess,
  createSupabaseServerClient,
  materializeInferredExecutionTaskDependencies,
};

/**
 * Testable core of the route handler (same DI pattern as the billing routes
 * and /api/vault/intake): `deps` defaults to the real implementations; tests
 * inject fakes so the authorization boundary can be verified without a live
 * backend.
 */
export async function handleMaterializeExecutionTaskDependencies(request: NextRequest, depsOverride: Partial<MaterializeExecutionTaskDependenciesDeps> = {}): Promise<NextResponse> {
  const deps: MaterializeExecutionTaskDependenciesDeps = { ...defaultDeps, ...depsOverride };
  let userId: string;
  try {
    const { user } = await deps.requireAuthenticatedUser();
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
    await deps.requireProjectAccess(projectId, "write");
  } catch (error) {
    if (error instanceof Error && error.message.includes("denied")) {
      return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: "Authorization failed." }, { status: 403 });
  }

  const supabase = await deps.createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id,user_id,workspace_id,name,description,status,onboarding_payload,created_at,updated_at")
    .eq("id", projectId)
    .maybeSingle<ProjectRow>();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found." }, { status: 404 });
  }

  const result = await deps.materializeInferredExecutionTaskDependencies({
    projectId,
    workspaceId: project.workspace_id,
    actorUserId: userId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: result.inserted, skipped: result.skipped });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleMaterializeExecutionTaskDependencies(request);
}
