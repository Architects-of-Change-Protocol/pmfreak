import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import { getPortfolioIntelligence } from "@/lib/portfolio/repository";
import { isValidISOTimestamp } from "@/lib/portfolio/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  let workspaceId = user.companyId;
  let evaluatedAt: string | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.workspaceId === "string" && body.workspaceId.trim()) {
      workspaceId = body.workspaceId.trim();
    }
    if (typeof body.evaluatedAt === "string" && body.evaluatedAt.trim()) {
      const candidate = body.evaluatedAt.trim();
      if (!isValidISOTimestamp(candidate)) {
        return NextResponse.json(
          { ok: false, error: "Invalid evaluatedAt timestamp.", code: "validation_failed" },
          { status: 400 },
        );
      }
      evaluatedAt = candidate;
    }
  } catch {
    // use defaults
  }

  const result = await getPortfolioIntelligence(workspaceId, { evaluatedAt });

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
