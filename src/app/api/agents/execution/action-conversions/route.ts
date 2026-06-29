import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import {
  createAgentActionConversion,
  listAgentActionConversions,
  normalizeCreateAgentActionConversionInput,
} from "@/lib/agents";

const ROUTE = "/api/agents/execution/action-conversions";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);
    void user;

    const filters = {
      status: url.searchParams.get("status") ?? undefined,
      readiness: url.searchParams.get("readiness") ?? undefined,
      riskLevel: url.searchParams.get("riskLevel") ?? undefined,
      actionDraftId: url.searchParams.get("actionDraftId") ?? undefined,
      reviewItemId: url.searchParams.get("reviewItemId") ?? undefined,
      approvalRequirement: url.searchParams.get("approvalRequirement") ?? undefined,
      ownerId: url.searchParams.get("ownerId") ?? undefined,
      ownerRole: url.searchParams.get("ownerRole") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };

    const conversions = await listAgentActionConversions(workspaceId, filters as never);
    return NextResponse.json({ ok: true, data: conversions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const normalized = normalizeCreateAgentActionConversionInput({
      workspaceId,
      actionDraftId: body.actionDraftId,
      ownerId: body.ownerId ?? null,
      ownerRole: body.ownerRole ?? null,
      createdBy: user.id,
    });

    const conversion = await createAgentActionConversion(normalized);
    return NextResponse.json({ ok: true, data: conversion }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: msg } }, { status: 500 });
  }
}
