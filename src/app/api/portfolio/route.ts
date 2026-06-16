import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { getPortfolioIntelligence } from "@/lib/portfolio/repository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let user;
  try {
    const ctx = await requireAuthenticatedUser();
    user = ctx.user;
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? user.companyId;

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
