import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { buildExecutionDispatchSummary } from "@/lib/agents";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    void user;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") ?? url.searchParams.get("workspace_id");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    const summary = await buildExecutionDispatchSummary({
      workspaceId,
      selectedAdapterKey: url.searchParams.get("selected_adapter_key") ?? undefined,
      selectedToolKey: url.searchParams.get("selected_tool_key") ?? undefined,
    });
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
