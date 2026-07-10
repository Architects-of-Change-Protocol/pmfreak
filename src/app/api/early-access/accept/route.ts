import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { acceptEarlyAccessInvite } from "@/lib/early-access";

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
    const [code, message] = raw.includes("::") ? raw.split("::", 2) : ["unknown_error", raw];
    return NextResponse.json({ error: message, code }, { status: 400 });
  }
}
