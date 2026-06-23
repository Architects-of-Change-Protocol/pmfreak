import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { generatePortfolioSnapshot } from "@/lib/personal-portfolio";
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

  const workspaceId = (body.workspaceId as string | undefined) ?? user.companyId;
  const portfolioId = body.portfolioId as string | undefined;
  const projectMetrics = body.projectMetrics as PortfolioProjectMetric[] | undefined;

  if (!portfolioId) {
    return NextResponse.json({ ok: false, error: "portfolioId is required." }, { status: 400 });
  }

  if (!Array.isArray(projectMetrics)) {
    return NextResponse.json({ ok: false, error: "projectMetrics array is required." }, { status: 400 });
  }

  const result = await generatePortfolioSnapshot({
    workspaceId,
    portfolioId,
    actorId: user.id,
    projectMetrics,
  });

  if (!result.ok) {
    const status = result.failureClass === "validation_failed" ? 400 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    snapshot: {
      id: result.data.id,
      portfolioId: result.data.portfolioId,
      totalProjects: result.data.totalProjects,
      healthyProjects: result.data.healthyProjects,
      warningProjects: result.data.warningProjects,
      criticalProjects: result.data.criticalProjects,
      overallHealth: result.data.overallHealth,
      rankedProjectIds: result.data.rankedProjectIds,
      attentionAllocation: result.data.attentionAllocation,
      generatedAt: result.data.generatedAt,
    },
    attentionItems: result.data.attentionItems,
  });
}
