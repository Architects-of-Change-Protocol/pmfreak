import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/aoc/runtime-consumer";
import { requireWorkspaceMember } from "@/lib/security/server-authorization";
import { listIngressEvents } from "@/lib/live-federation/ingestion/live-ingestion-runtime";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? "";
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  try {
    await requireWorkspaceMember(workspaceId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  return NextResponse.json({ workspaceId, events: listIngressEvents(workspaceId) });
}
