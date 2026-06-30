import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { generateDemoDataBundle, listDemoDataBundles } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    if (!body.planId) return NextResponse.json({ ok: false, error: { code: "MISSING_PLAN", message: "planId required" } }, { status: 400 });
    if (!body.bundleType) return NextResponse.json({ ok: false, error: { code: "MISSING_BUNDLE_TYPE", message: "bundleType required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    const result = await generateDemoDataBundle(body.workspaceId, body.planId, body.bundleType);
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(workspaceId);
    const planId = searchParams.get("planId") ?? undefined;
    const records = await listDemoDataBundles(workspaceId, planId);
    return NextResponse.json({ ok: true, data: records });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
