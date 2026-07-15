import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceMember } from "@/lib/security/server-authorization";
import { updateAgentPmoOutgoingPmNoteStatus, validateAgentPmoOutgoingPmNoteStatus } from "@/lib/agents";
import { safeInternalErrorResponse } from "@/lib/security/safe-route-error";

export async function POST(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    await requireAuthenticatedUser();
    const { noteId } = await params;
    const body = await request.json();
    if (!body.workspaceId) return NextResponse.json({ ok: false, error: { code: "MISSING_WORKSPACE", message: "workspaceId required" } }, { status: 400 });
    await requireWorkspaceMember(body.workspaceId);
    if (!validateAgentPmoOutgoingPmNoteStatus(body.noteStatus)) return NextResponse.json({ ok: false, error: { code: "INVALID_STATUS", message: "Invalid noteStatus" } }, { status: 400 });
    const record = await updateAgentPmoOutgoingPmNoteStatus(noteId, body.noteStatus);
    if (!record) return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    return NextResponse.json({ ok: true, data: record });
  } catch (err) {
    return safeInternalErrorResponse("/api/agents/execution/project-handoff/outgoing-notes/[noteId]/status", err);
  }
}
