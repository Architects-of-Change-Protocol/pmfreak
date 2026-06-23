import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { rankPortfolioProjects, calculatePortfolioAttentionScore } from "@/lib/personal-portfolio";
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
  if (!Array.isArray(projectMetrics)) {
    return NextResponse.json({ ok: false, error: "projectMetrics array is required." }, { status: 400 });
  }

  const ranking = rankPortfolioProjects(projectMetrics);

  return NextResponse.json({
    ok: true,
    ranking: ranking.rankedProjects,
    generatedAt: ranking.generatedAt,
  });
}
