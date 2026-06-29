import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { cancelActionConversion } from "@/lib/agents";

const ROUTE = "/api/agents/execution/action-conversions/[conversionId]/cancel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversionId: string }> },
) {
  try {
    const { user } = await requireAuthenticatedUser();
    const { conversionId } = await params;
    const body = await request.json();
    const { workspaceId, message } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const conversion = await cancelActionConversion({ workspaceId, conversionId, actorId: user.id, message: message ?? null });
    return NextResponse.json({ ok: true, data: conversion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
