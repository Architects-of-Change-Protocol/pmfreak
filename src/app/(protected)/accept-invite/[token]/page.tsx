import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireAuthUser } from "@/lib/auth";
import { acceptWorkspaceInvite, WorkspaceInviteError } from "@/lib/workspace-team";
import { buildAbuseKey, enforceAbuseLimit, getClientIpFromHeaders } from "@/lib/security/abuse-protection";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "This invite link is invalid.",
  invalid_role: "This invite is misconfigured and cannot be accepted.",
  email_mismatch: "This invitation was issued to a different email address.",
  expired: "This invitation has expired.",
  revoked: "This invitation has been revoked.",
  already_used: "This invitation has already been used.",
};

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requireAuthUser();
  const { token } = await params;

  // Brute-force / replay protection, separate from the token validation
  // itself: an IP-wide limit slows down guessing many tokens, and a
  // per-token limit slows down hammering one specific token. The raw token
  // is never persisted — enforceAbuseLimit hashes it before use. See
  // docs/security/abuse-protection-boundary.md ("workspace.invite_accept").
  const headersList = await headers();
  const clientIp = getClientIpFromHeaders(headersList);
  const ipDecision = await enforceAbuseLimit({
    scope: "workspace.invite_accept",
    identifier: clientIp,
    limit: 20,
    windowSeconds: 3600,
  });
  const tokenDecision = ipDecision.allowed
    ? await enforceAbuseLimit({
        scope: "workspace.invite_accept",
        action: "per_token",
        identifier: buildAbuseKey([clientIp, token]),
        limit: 10,
        windowSeconds: 3600,
      })
    : ipDecision;
  if (!ipDecision.allowed || !tokenDecision.allowed) {
    throw new Error("Too many attempts. Please wait a moment and try again.");
  }

  try {
    await acceptWorkspaceInvite({ token, userId: user.id, userEmail: user.email });
  } catch (error) {
    if (error instanceof WorkspaceInviteError) {
      if (error.reason === "invalid_token") notFound();
      throw new Error(ERROR_MESSAGES[error.reason] ?? "Unable to accept this invitation.");
    }
    throw error;
  }

  redirect("/team");
}
