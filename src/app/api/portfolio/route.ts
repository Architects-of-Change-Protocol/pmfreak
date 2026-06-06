import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import { getPortfolioIntelligence } from "@/lib/portfolio/repository";
import { isValidISOTimestamp } from "@/lib/portfolio/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let user;
  try {
    const ctx = await requireAuthenticatedUser();
    user = ctx.user;
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ ok: false, error: "Unauthenticated." }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: "Authorization failed." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? user.companyId;
  const evaluatedAtParam = searchParams.get("evaluatedAt");

  if (evaluatedAtParam !== null && !isValidISOTimestamp(evaluatedAtParam)) {
    return NextResponse.json(
      { ok: false, error: "Invalid evaluatedAt timestamp.", code: "validation_failed" },
      { status: 400 },
    );
  }

  const result = await getPortfolioIntelligence(workspaceId, {
    evaluatedAt: evaluatedAtParam ?? undefined,
  });

  if (!result.ok) {
    const status = result.failureClass === "unauthenticated" ? 401 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    evaluatedAt: result.data.summary.lastUpdatedAt,
    summary: result.data.summary,
    projects: result.data.projects,
    bottlenecks: result.data.bottlenecks,
    dependencyRisks: result.data.dependencyRisks,
    executiveAttention: result.data.executiveAttention,
  });
}
