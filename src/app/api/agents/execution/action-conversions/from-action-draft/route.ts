import { NextResponse } from "next/server";
import { denyResponse } from "@/lib/security/deny-response";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { createConversionFromActionDraft } from "@/lib/agents";

const ROUTE = "/api/agents/execution/action-conversions/from-action-draft";

export async function POST(request: Request) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = await request.json();
    const { workspaceId, actionDraftId, ownerRole, ownerId } = body;
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    }
    if (!actionDraftId) {
      return NextResponse.json({ ok: false, error: { code: "MISSING_ACTION_DRAFT", message: "actionDraftId required" } }, { status: 400 });
    }
    await requireWorkspaceMember(workspaceId);

    const conversion = await createConversionFromActionDraft({
      workspaceId,
      actionDraftId,
      ownerId: ownerId ?? null,
      ownerRole: ownerRole ?? null,
      actorId: user.id,
    });
    return NextResponse.json({ ok: true, data: conversion }, { status: 201 });
  } catch (err) {
    return denyResponse(err, ROUTE, "POST");
  }
}
