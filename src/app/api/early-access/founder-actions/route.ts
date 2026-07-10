import { NextResponse } from "next/server";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { approveEarlyAccessInvite, extendTrialLicense, resendEarlyAccessInviteEmail, revokeEarlyAccessInvite, revokeTrialLicense } from "@/lib/early-access";

// Founder/internal authorization must be resolved and enforced BEFORE the
// request body is ever parsed or a mutation function is called. No
// role/actorRole/isFounder/isAdmin field is read from the request body — the
// actor's identity and authority come exclusively from `user`, resolved
// server-side by requireAuthUser()/isFounderOrInternalUser() above.
export async function POST(request: Request) {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) {
    return NextResponse.json({ error: "Founder access is required." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    body = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const reason = typeof body.reason === "string" ? body.reason : undefined;

  try {
    if (action === "approve_invite") {
      await approveEarlyAccessInvite(String(body.inviteId ?? ""), user.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "revoke_invite") {
      await revokeEarlyAccessInvite(String(body.inviteId ?? ""), user.id, reason);
      return NextResponse.json({ ok: true });
    }
    if (action === "resend_invite_email") {
      const result = await resendEarlyAccessInviteEmail(String(body.inviteId ?? ""), user.id);
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === "revoke_trial") {
      await revokeTrialLicense(String(body.trialId ?? ""), user.id, reason);
      return NextResponse.json({ ok: true });
    }
    if (action === "extend_trial") {
      await extendTrialLicense(String(body.trialId ?? ""), Number(body.extensionDays ?? 7), user.id, reason);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unable to perform founder action.";
    const message = raw.includes("::") ? raw.split("::", 2)[1] : raw;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
