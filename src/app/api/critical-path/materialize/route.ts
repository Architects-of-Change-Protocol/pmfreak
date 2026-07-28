import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { materializeCriticalPath } from "@/lib/critical-path/materialize-critical-path";

export type MaterializeCriticalPathDeps = {
  requireAuthenticatedUser: typeof requireAuthenticatedUser;
  requireProjectAccess: typeof requireProjectAccess;
  materializeCriticalPath: typeof materializeCriticalPath;
};

const defaultDeps: MaterializeCriticalPathDeps = {
  requireAuthenticatedUser,
  requireProjectAccess,
  materializeCriticalPath,
};

/**
 * Testable core of the route handler (same DI pattern as
 * /api/execution-task-dependencies/materialize and the billing routes):
 * `deps` defaults to the real implementations; tests inject fakes so the
 * authorization boundary can be verified without a live backend.
 */
export async function handleMaterializeCriticalPath(request: NextRequest, depsOverride: Partial<MaterializeCriticalPathDeps> = {}): Promise<NextResponse> {
  const deps: MaterializeCriticalPathDeps = { ...defaultDeps, ...depsOverride };

  try {
    await deps.requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  let body: { projectId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const { projectId } = body;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
  }

  try {
    await deps.requireProjectAccess(projectId, "write");
  } catch {
    return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
  }

  const result = await deps.materializeCriticalPath({ projectId });

  if (!result.ok) {
    const status = result.failureClass === "cycle_detected" ? 422 : 500;
    return NextResponse.json({ ok: false, error: result.error, failureClass: result.failureClass }, { status });
  }

  return NextResponse.json({
    ok: true,
    criticalTaskIds: result.criticalTaskIds,
    projectFinish: result.projectFinish,
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleMaterializeCriticalPath(request);
}
