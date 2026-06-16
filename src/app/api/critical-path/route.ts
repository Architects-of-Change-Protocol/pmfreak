import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { getProjectCriticalPath } from "@/lib/critical-path/repository";

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
  } catch {
    return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
  }

  const result = await getProjectCriticalPath(projectId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    summary: result.data.summary,
    forecast: result.data.forecast,
    criticalTasks: result.data.criticalTasks,
    criticalMilestones: result.data.criticalMilestones,
    path: result.data.path,
    topVarianceTasks: result.data.topVarianceTasks,
    criticalPaths: result.data.criticalPaths,
    criticalSegments: result.data.criticalSegments,
    branchPoints: result.data.branchPoints,
    topology: result.data.topology,
  });
}
