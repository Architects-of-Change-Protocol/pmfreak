import { notFound } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { loadFounderProgramConfig } from "@/lib/founder-program/config";
import { markFounderInvitationViewed, resolveFounderInvitationByToken } from "@/lib/founder-program/invitations";
import { recordFounderCheckpoint } from "@/lib/founder-program/checkpoints";
import { FounderApplicationForm } from "./application-form";

// Invitation landing: honest description of a closed pilot, then the
// invite-bound application. Requires authentication (login redirect via the
// protected layout); with the program disabled this page does not exist.
export default async function FounderInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requireAuthUser();
  const config = await loadFounderProgramConfig();
  if (!config.enabled) notFound();

  const { token } = await params;
  const resolved = await resolveFounderInvitationByToken(token);
  const programName = config.settings.displayName;

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-cyan-300">{programName}</p>
        <h1 className="text-2xl font-semibold text-slate-100">Invitation</h1>
      </header>
      {children}
    </div>
  );

  if (!resolved || resolved.status === "revoked" || resolved.status === "expired") {
    return shell(
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
        <p className="text-slate-200">This invitation link is invalid or has expired.</p>
        <p className="mt-2 text-sm text-slate-400">
          If you believe this is a mistake, reply to the invitation email and we can issue a fresh link.
        </p>
      </div>,
    );
  }

  const emailMatches = resolved.email === (user.email ?? "").trim().toLowerCase();
  if (!emailMatches) {
    return shell(
      <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-6">
        <p className="text-amber-100">This invitation was issued to a different email address.</p>
        <p className="mt-2 text-sm text-amber-200/80">
          Sign in with the account that received the invitation, or reply to the invitation email to have it reissued.
        </p>
      </div>,
    );
  }

  if (resolved.status === "pending") {
    await markFounderInvitationViewed(resolved);
    await recordFounderCheckpoint({ participantId: resolved.participantId, userId: user.id, checkpoint: "invite_opened" });
  }

  if (resolved.status === "applied") {
    return shell(
      <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
        <p className="text-slate-200">An application was already submitted for this invitation.</p>
        <a href="/founder-circle" className="mt-3 inline-block rounded-full border border-cyan-300/50 px-4 py-2 text-sm text-cyan-200">
          View your program status
        </a>
      </div>,
    );
  }

  const applicationsOpen = config.flags.applicationsEnabled && config.settings.applicationsEnabled;

  return shell(
    <>
      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-3">
        <h2 className="text-lg font-medium text-slate-100">What this is — honestly</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>A small, <strong>closed pilot</strong> of PMFreak with a hard participant cap. Admission is reviewed by a human.</li>
          <li>The product is <strong>early</strong>: surfaces will change, some capabilities are intentionally hidden, and things may break.</li>
          <li>We ask for <strong>structured feedback</strong> in exchange for early access. Participation is free; there is no payment step.</li>
          <li>Being a &ldquo;{programName}&rdquo; participant is an early-access role. It does <strong>not</strong> make you a company founder, cofounder, or equity holder.</li>
          <li>You can withdraw at any time, before or after approval.</li>
        </ul>
        {config.settings.supportContact ? (
          <p className="text-xs text-slate-500">Questions? Contact {config.settings.supportContact}.</p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
        <h2 className="mb-4 text-lg font-medium text-slate-100">Application</h2>
        {applicationsOpen ? (
          <FounderApplicationForm token={token} />
        ) : (
          <p className="text-sm text-slate-300">
            Applications are currently closed. Your invitation remains valid until{" "}
            {new Date(resolved.expiresAt).toLocaleDateString()} — we will let you know when the application window opens.
          </p>
        )}
      </section>
    </>,
  );
}
