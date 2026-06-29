import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { getAgentActionConversionById } from "@/lib/agents";

const ROUTE = "/api/agents/execution/action-conversions/[conversionId]";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversionId: string }> },
) {
  try {
    const { user: _user } = await requireAuthenticatedUser();
    const { conversionId } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const conversion = await getAgentActionConversionById(workspaceId, conversionId);
    if (!conversion) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Conversion not found" } }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: conversion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
