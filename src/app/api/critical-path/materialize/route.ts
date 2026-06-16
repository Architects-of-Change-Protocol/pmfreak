import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { requireProjectAccess } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { materializeCriticalPath } from "@/lib/critical-path/materialize-critical-path";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
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
    await requireProjectAccess(projectId, "read");
  } catch {
    return NextResponse.json({ ok: false, error: "Access denied." }, { status: 403 });
  }

  const result = await materializeCriticalPath({ projectId });

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
