import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { acceptEarlyAccessInvite } from "@/lib/early-access";

export async function POST(request: Request) {
  const user = await requireAuthUser();
  const body = await request.json();
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
