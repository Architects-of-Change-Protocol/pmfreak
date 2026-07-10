import { NextRequest } from "next/server";
import { isFounderOrInternalUser, requireAuthUser } from "@/lib/auth";
import { approveTrustHandshake } from "@/lib/security/trust-handshakes";

// Approving a trust handshake grants an external verifier standing capability
// authority (a verifier policy is created for the requested trust domain/
// actions). This is a founder/internal-only action. The approver's identity
// comes exclusively from requireAuthUser()'s session — never from a
// caller-supplied approver id in the request body, which would let an
// unauthenticated caller attribute the approval to an arbitrary user id.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireAuthUser();
  if (!isFounderOrInternalUser(user)) {
    return Response.json({ error: "Founder access is required." }, { status: 403 });
  }
  const { id } = await context.params;
  const handshake = await approveTrustHandshake({ id, approverUserId: user.id });
  return Response.json({ status: handshake.status, approvedAt: handshake.approved_at });
}
