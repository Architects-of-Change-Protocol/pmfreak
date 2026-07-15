import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { acceptEarlyAccessInvite } from "@/lib/early-access";
import { abuseDenyResponse, buildAbuseKey, enforceAbuseLimit, getClientIp } from "@/lib/security/abuse-protection";
import { logger, safeErrorMessage } from "@/lib/observability/logger";

// Accepting an early-access invite is not a founder action: it requires only
// that the caller is authenticated and that the invite's own email matches
// theirs (enforced inside acceptEarlyAccessInvite). No isFounder/role/isAdmin
// field is read from the request body here or in acceptEarlyAccessInvite's
// input type — they cannot grant founder/internal access through this route.
export async function POST(request: Request) {
  const user = await requireAuthUser();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body.", code: "invalid_request" }, { status: 400 });
  }

  // Brute-force / replay protection, separate from authentication above —
  // see docs/security/abuse-protection-boundary.md ("early_access.accept").
  // The raw invite token is never persisted; enforceAbuseLimit hashes it.
  const clientIp = getClientIp(request);
  const inviteToken = String(body.inviteToken ?? "");
  const ipDecision = await enforceAbuseLimit({ scope: "early_access.accept", identifier: clientIp, limit: 20, windowSeconds: 3600 });
  const tokenDecision = ipDecision.allowed
    ? await enforceAbuseLimit({ scope: "early_access.accept", action: "per_token", identifier: buildAbuseKey([clientIp, inviteToken]), limit: 10, windowSeconds: 3600 })
    : ipDecision;
  if (!ipDecision.allowed) return abuseDenyResponse(ipDecision);
  if (!tokenDecision.allowed) return abuseDenyResponse(tokenDecision);

  try {
    const accepted = await acceptEarlyAccessInvite({
      inviteToken: String(body.inviteToken ?? ""),
      userId: user.id,
      userEmail: user.email,
      workspaceName: typeof body.workspaceName === "string" ? body.workspaceName : undefined,
    });
    return NextResponse.json(accepted);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unable to accept invite.";
    // Only the domain's own `code::message` vocabulary is user-facing; any
    // other message may carry raw driver text and stays server-side.
    if (!raw.includes("::")) {
      logger.error("route_internal_error", { route: "/api/early-access/accept", error_detail: safeErrorMessage(error) });
      return NextResponse.json({ error: "Unable to accept invite. Please retry.", code: "unknown_error" }, { status: 400 });
    }
    const [code, message] = raw.split("::", 2);
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
