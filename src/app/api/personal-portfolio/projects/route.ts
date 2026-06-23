import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/security/server-authorization";
import {
  addProjectToPortfolio,
  removeProjectFromPortfolio,
  listPortfolioProjects,
} from "@/lib/personal-portfolio";

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
  const portfolioId = searchParams.get("portfolioId");

  if (!portfolioId) {
    return NextResponse.json({ ok: false, error: "portfolioId is required." }, { status: 400 });
  }

  const result = await listPortfolioProjects({ workspaceId, portfolioId });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, projects: result.data });
}

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
  const projectId = body.projectId as string | undefined;

  if (!portfolioId || !projectId) {
    return NextResponse.json({ ok: false, error: "portfolioId and projectId are required." }, { status: 400 });
  }

  const result = await addProjectToPortfolio({
    workspaceId,
    portfolioId,
    projectId,
    actorId: user.id,
  });

  if (!result.ok) {
    const status =
      result.failureClass === "validation_failed" ? 400 :
      result.failureClass === "duplicate" ? 409 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, entry: result.data }, { status: 201 });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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
  const projectId = body.projectId as string | undefined;

  if (!portfolioId || !projectId) {
    return NextResponse.json({ ok: false, error: "portfolioId and projectId are required." }, { status: 400 });
  }

  const result = await removeProjectFromPortfolio({
    workspaceId,
    portfolioId,
    projectId,
    actorId: user.id,
  });

  if (!result.ok) {
    const status = result.failureClass === "not_found" ? 404 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
