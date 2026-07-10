import { NextRequest } from "next/server";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { rejectTrustHandshake } from "@/lib/security/trust-handshakes";

// Founder/internal-only, same trust boundary as approve — see that route's
// comment. rejectorUserId always comes from the session, never the body.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) {
    return Response.json({ error: "Founder access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const handshake = await rejectTrustHandshake({ id, rejectorUserId: user.id, reason: typeof body.reason === "string" ? body.reason : undefined });
  return Response.json({ status: handshake.status, rejectedAt: handshake.rejected_at });
}
