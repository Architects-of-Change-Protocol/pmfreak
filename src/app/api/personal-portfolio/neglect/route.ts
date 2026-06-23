import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { generateNeglectConsequences, analyzeProjectNeglect } from "@/lib/personal-portfolio";
import type { PortfolioProjectMetric } from "@/lib/personal-portfolio";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const projectMetrics = body.projectMetrics as PortfolioProjectMetric[] | undefined;
  const projectId = body.projectId as string | undefined;

  if (!Array.isArray(projectMetrics)) {
    return NextResponse.json({ ok: false, error: "projectMetrics array is required." }, { status: 400 });
  }

  if (projectId) {
    const metric = projectMetrics.find((m) => m.projectId === projectId);
    if (!metric) {
      return NextResponse.json({ ok: false, error: "Project not found in metrics." }, { status: 404 });
    }
    const consequence = analyzeProjectNeglect(metric);
    return NextResponse.json({ ok: true, consequence });
  }

  const analysis = generateNeglectConsequences(projectMetrics);

  return NextResponse.json({
    ok: true,
    consequences: analysis.consequences,
    mostCriticalProjectId: analysis.mostCriticalProjectId,
    generatedAt: analysis.generatedAt,
  });
}
