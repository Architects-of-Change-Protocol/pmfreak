import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { getPortfolioIntelligence } from "@/lib/portfolio/repository";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let user;
  try {
    const ctx = await requireAuthenticatedUser();
    user = ctx.user;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  let workspaceId = user.companyId;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.workspaceId === "string" && body.workspaceId.trim()) {
      workspaceId = body.workspaceId.trim();
    }
  } catch {
    // use default
  }

  const result = await getPortfolioIntelligence(workspaceId);

  if (!result.ok) {
    const status = result.failureClass === "unauthenticated" ? 401 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    summary: result.data.summary,
    projects: result.data.projects,
    bottlenecks: result.data.bottlenecks,
    dependencyRisks: result.data.dependencyRisks,
    executiveAttention: result.data.executiveAttention,
  });
}
