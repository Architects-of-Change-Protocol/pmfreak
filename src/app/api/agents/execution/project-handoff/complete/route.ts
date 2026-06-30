import { NextResponse } from "next/server";
import { evaluateCapability } from "@/lib/security/server-authorization";
import { AccessDeniedError } from "@/lib/security/access-guards";
import { completeProjectHandoff } from "@/lib/agents";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await evaluateCapability({ permission: "manage_projects", workspaceId: body.workspaceId });
    const result = await completeProjectHandoff(body);
    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ ok: false, error: { code: "FORBIDDEN", message: err.message } }, { status: 403 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
