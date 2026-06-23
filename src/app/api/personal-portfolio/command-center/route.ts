import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import {
  generatePersonalCommandCenter,
  getTodayFocus,
  getCriticalProjects,
  generateRecommendedAgenda,
} from "@/lib/personal-portfolio";
import type { PortfolioProjectMetric } from "@/lib/personal-portfolio";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let user;
  try {
    const ctx = await requireAuthenticatedUser();
    user = ctx.user;
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

  const commandCenter = generatePersonalCommandCenter({
    ownerId: user.id,
    metrics: projectMetrics,
  });

  const todayFocus = getTodayFocus(commandCenter);
  const criticalProjects = getCriticalProjects(projectMetrics);
  const recommendedAgenda = generateRecommendedAgenda(projectMetrics);

  return NextResponse.json({
    ok: true,
    commandCenter,
    today: {
      critical: todayFocus.critical,
      high: todayFocus.high,
    },
    criticalProjects: criticalProjects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      healthScore: p.healthScore,
      riskScore: p.riskScore,
    })),
    recommendedOrder: recommendedAgenda,
    summary: commandCenter.todaySummary,
  });
}
