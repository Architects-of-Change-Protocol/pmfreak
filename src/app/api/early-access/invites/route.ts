import { NextResponse } from "next/server";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { createEarlyAccessInvite } from "@/lib/early-access";
import { abuseDenyResponse, enforceAbuseLimit } from "@/lib/security/abuse-protection";

// Only inviteEmail/inviteNote/requiresApproval are ever read from the body —
// role/isFounder/isAdmin/permissions fields sent by a caller are ignored,
// since createEarlyAccessInvite's input type has no parameter for them.
export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) return NextResponse.json({ error: "Founder access is required." }, { status: 403 });

  // Even a real founder can flood invite creation — see
  // docs/security/abuse-protection-boundary.md ("early_access.invite_create").
  const abuseDecision = await enforceAbuseLimit({ scope: "early_access.invite_create", identifier: user.id, limit: 30, windowSeconds: 3600 });
  if (!abuseDecision.allowed) return abuseDenyResponse(abuseDecision);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  try {
    const invite = await createEarlyAccessInvite({
      inviteEmail: String(body.inviteEmail ?? ""),
      inviterUserId: user.id,
      inviteNote: typeof body.inviteNote === "string" ? body.inviteNote : undefined,
      requiresApproval: body.requiresApproval === true,
    });
    return NextResponse.json(invite);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unable to create invite.";
    const message = raw.includes("::") ? raw.split("::", 2)[1] : raw;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
