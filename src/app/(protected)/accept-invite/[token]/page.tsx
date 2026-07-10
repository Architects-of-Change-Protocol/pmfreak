import { notFound, redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { acceptWorkspaceInvite, WorkspaceInviteError } from "@/lib/workspace-team";

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
