import { WorkspaceOnboardingPanel } from "@/components/pmfreak/onboarding/workspace-onboarding-panel";

const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-sky-500/40 focus:bg-white/[0.05] focus:ring-2 focus:ring-sky-500/10";

export function CommandCenterEmptyState({
  activateAction,
  errorMessage,
  fromOnboarding = false,
  pmoName = null,
}: {
  activateAction: (formData: FormData) => void | Promise<void>;
  errorMessage?: string;
  /** True for the one-time arrival right after Command Center activation. */
  fromOnboarding?: boolean;
  /** Real PMO name, when one exists for this workspace — never a placeholder. */
  pmoName?: string | null;
}) {
  return (
    <div
      data-build="command-center-light-v2-empty"
      data-shell="pmfreak-light-command-center"
      className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0d] shadow-[0_40px_90px_-60px_rgba(0,0,0,0.7)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-zinc-100">No project selected</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Create your first project inside this Command Center to activate PMFreak&apos;s operational intelligence.
          </p>
          <p className="mt-1 text-xs text-zinc-500">Agents are waiting for project data.</p>
        </div>
      </header>

      {fromOnboarding && pmoName && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 sm:px-5">
          <p className="text-sm text-cyan-100">
            <span className="font-semibold">{pmoName}</span> is online. Invite your team to start collaborating.
          </p>
          <a
            href="/pmo/invite-team"
            className="shrink-0 rounded-lg border border-cyan-500/25 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
          >
            Invite Team →
          </a>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[280px_1fr_320px]">
        <aside className="hidden shrink-0 space-y-3 border-r border-white/10 bg-white/[0.015] p-4 lg:block">
          <WorkspaceOnboardingPanel surface="dashboard" />
        </aside>

        <main className="min-w-0 p-4 sm:p-5">
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          <form action={activateAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Project name</span>
                <span className="block text-[11px] text-zinc-500">The initiative PMFreak will begin monitoring</span>
                <input required name="name" placeholder="Q3 Enterprise Platform Rollout" className={fieldClass} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Customer / sponsor</span>
                <span className="block text-[11px] text-zinc-500">Executive accountable for delivery</span>
                <input name="sponsor" placeholder="VP Operations" className={fieldClass} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Current phase</span>
                <span className="block text-[11px] text-zinc-500">Where the initiative sits in its lifecycle</span>
                <input name="phase" placeholder="Pilot execution" className={fieldClass} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Timeline pressure</span>
                <span className="block text-[11px] text-zinc-500">PMFreak calibrates urgency from this signal</span>
                <input name="timeline" placeholder="High — board update in 3 weeks" className={fieldClass} />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-zinc-300">Top known risk</span>
                <input name="risk" placeholder="Cross-team dependency delays" className={fieldClass} />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-zinc-300">Key stakeholders</span>
                <input name="stakeholders" placeholder="Ops lead, Finance partner, Vendor PM" className={fieldClass} />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-zinc-300">Operational context</span>
                <span className="block text-[11px] text-zinc-500">
                  Describe objectives, constraints, and current pressure points — paste meeting notes or a project
                  brief here. More context improves signal accuracy.
                </span>
                <textarea
                  name="description"
                  rows={5}
                  placeholder="Add initiative context, objectives, constraints, and current pressure points."
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(56,189,248,0.4)] transition hover:brightness-110"
              >
                Create project
              </button>
              <p className="text-[11px] text-zinc-500">You can keep refining project context after save.</p>
            </div>
          </form>
        </main>

        <aside className="hidden shrink-0 space-y-3 border-l border-white/10 bg-white/[0.015] p-4 xl:block">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Command feed</p>
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs leading-relaxed text-zinc-500">
            The command feed activates once your first project exists.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 opacity-60">
            <input
              disabled
              placeholder="Ask about status, risks, actions, decisions..."
              className="flex-1 bg-transparent text-sm text-zinc-500 outline-none"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
