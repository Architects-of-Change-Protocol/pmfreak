import { notFound } from "next/navigation";
import { requireAuthUser } from "@/lib/auth";
import { loadFounderProgramConfig } from "@/lib/founder-program/config";
import { createFounderProgramDbClient } from "@/lib/founder-program/db";
import { getFounderCheckpoints } from "@/lib/founder-program/checkpoints";
import { grantsProgramAccess, type FounderLifecycleState } from "@/lib/founder-program/lifecycle";
import { listOwnFounderFeedback } from "@/lib/founder-program/feedback";
import { FounderFeedbackForm, FounderWithdrawButton } from "./participant-actions";

const STATE_COPY: Partial<Record<FounderLifecycleState, { title: string; body: string }>> = {
  applied: { title: "Application received", body: "A human reviews every application. We will get back to you either way — no action is needed right now." },
  under_review: { title: "Under review", body: "Your application is being reviewed. We will get back to you either way." },
  approved: { title: "Approved", body: "Your application was approved. The next step is the pilot agreement." },
  waitlisted: { title: "Waitlisted", body: "The current cohort is at capacity. We will reach out if a seat opens. You may withdraw at any time." },
  rejected: { title: "Not included this time", body: "We could not include you in this cohort. Thank you for the time you invested in applying." },
  agreement_pending: { title: "Agreement step", body: "Please review and accept the current pilot agreement to continue. Access is activated after that." },
  agreement_accepted: { title: "Agreement accepted", body: "Thanks — your access will be activated by the program operator shortly." },
  onboarding_pending: { title: "Ready for activation", body: "Everything on your side is done. The program operator activates access manually — you will be notified." },
  onboarding_active: { title: "Onboarding", body: "Your access is active. Create your first project and explore the core workflows." },
  activated: { title: "Active participant", body: "You are fully onboarded. Feedback below goes straight to the team." },
  feedback_active: { title: "Active participant", body: "Thanks for the feedback so far — keep it coming." },
  paused: { title: "Participation paused", body: "Your participation is paused and program access is disabled. We will contact you about next steps." },
  completed: { title: "Participation completed", body: "Your participation has concluded. Thank you for helping shape PMFreak." },
  withdrawn: { title: "Withdrawn", body: "You withdrew from the program. Your data-return options are described in the pilot agreement." },
  revoked: { title: "Access ended", body: "Your program access has ended. Reply to the program contact for data-return options." },
};

// Participant status page — strictly self-scoped, honest state copy, no
// dark patterns. With the program disabled this page does not exist.
export default async function FounderCirclePage() {
  const user = await requireAuthUser();
  const config = await loadFounderProgramConfig();
  if (!config.enabled) notFound();

  const client = createFounderProgramDbClient({ operation: "participant_status_page", actorUserId: user.id });
  const { data: participant } = await client
    .from("founder_participants")
    .select("id, lifecycle_state, archetype, cohort, workspace_id, agreement_version_accepted, activated_at, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const programName = config.settings.displayName;

  if (!participant) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold text-slate-100">{programName}</h1>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-slate-200">This account is not part of the {programName}.</p>
          <p className="mt-2 text-sm text-slate-400">
            The program is a small, invite-only closed pilot. If you received an invitation email, open the link it contains
            with this account.
          </p>
        </div>
      </div>
    );
  }

  const state = participant.lifecycle_state as FounderLifecycleState;
  const copy = STATE_COPY[state] ?? { title: state, body: "" };
  const checkpoints = await getFounderCheckpoints(participant.id, { client });
  const agreementCurrent = participant.agreement_version_accepted === config.settings.requiredAgreementVersion;
  const showAgreementCta = state === "agreement_pending" || (grantsProgramAccess(state) && !agreementCurrent);
  const feedback = config.flags.feedbackEnabled ? await listOwnFounderFeedback(user.id, { client }) : [];
  const canWithdraw = !["rejected", "completed", "withdrawn", "revoked", "nominated", "invited", "invite_viewed"].includes(state);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-cyan-300">{programName}</p>
        <h1 className="text-2xl font-semibold text-slate-100">{copy.title}</h1>
        <p className="text-sm text-slate-400">
          Early-access pilot participant status. This is a closed pilot: the product is early and functionality may change.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-3">
        <p className="text-slate-200">{copy.body}</p>
        {showAgreementCta ? (
          <a href="/pilot-agreement" className="inline-block rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">
            Review &amp; accept the pilot agreement
          </a>
        ) : null}
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Program status</dt>
          <dd className="text-slate-200">{state.replaceAll("_", " ")}</dd>
          <dt className="text-slate-500">Agreement version accepted</dt>
          <dd className="text-slate-200">{participant.agreement_version_accepted ?? "none yet"}</dd>
        </dl>
        {config.settings.supportContact ? (
          <p className="text-xs text-slate-500">Program support: {config.settings.supportContact}</p>
        ) : null}
      </section>

      {checkpoints.length > 0 ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <h2 className="mb-3 text-lg font-medium text-slate-100">Your onboarding milestones</h2>
          <ul className="space-y-1 text-sm text-slate-300">
            {checkpoints.map((c) => (
              <li key={c.checkpoint} className="flex justify-between gap-2">
                <span>{c.checkpoint.replaceAll("_", " ")}</span>
                <span className="text-slate-500">{new Date(c.reachedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {config.flags.feedbackEnabled && grantsProgramAccess(state) ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-100">Structured feedback</h2>
          <FounderFeedbackForm />
          {feedback.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-slate-400">Your submissions</h3>
              <ul className="space-y-2 text-sm">
                {feedback.map((f) => (
                  <li key={String(f.id)} className="rounded-lg border border-slate-700/60 p-3">
                    <div className="flex justify-between gap-2 text-xs text-slate-500">
                      <span>{String(f.feedback_type).replaceAll("_", " ")} · {String(f.severity)}</span>
                      <span>status: {String(f.status)}</span>
                    </div>
                    <p className="mt-1 text-slate-300">{String(f.body)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {canWithdraw ? (
        <footer>
          <FounderWithdrawButton />
        </footer>
      ) : null}
    </div>
  );
}
