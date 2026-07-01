const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100";

export function CommandCenterEmptyState({
  activateAction,
  errorMessage,
}: {
  activateAction: (formData: FormData) => void | Promise<void>;
  errorMessage?: string;
}) {
  return (
    <div
      data-build="command-center-light-v2-empty"
      data-shell="pmfreak-light-command-center"
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#FCFBF9] shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/70 px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-slate-900">No project selected</h1>
          <p className="mt-1 text-xs text-slate-400">
            Create or import your first project to activate PMFreak&apos;s operational intelligence.
          </p>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-[280px_1fr_320px]">
        <aside className="hidden shrink-0 space-y-3 border-r border-slate-200 bg-white/60 p-4 lg:block">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Get started</p>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-sm font-medium text-slate-800">Upload project documents</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Unlocks once your first project is created.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-sm font-medium text-slate-800">Paste meeting notes</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Unlocks once your first project is created.
            </p>
          </div>
        </aside>

        <main className="min-w-0 p-4 sm:p-5">
          {errorMessage && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">
              {errorMessage}
            </div>
          )}

          <form action={activateAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Project name</span>
                <span className="block text-[11px] text-slate-400">The initiative PMFreak will begin monitoring</span>
                <input required name="name" placeholder="Q3 Enterprise Platform Rollout" className={fieldClass} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Customer / sponsor</span>
                <span className="block text-[11px] text-slate-400">Executive accountable for delivery</span>
                <input name="sponsor" placeholder="VP Operations" className={fieldClass} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Current phase</span>
                <span className="block text-[11px] text-slate-400">Where the initiative sits in its lifecycle</span>
                <input name="phase" placeholder="Pilot execution" className={fieldClass} />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Timeline pressure</span>
                <span className="block text-[11px] text-slate-400">PMFreak calibrates urgency from this signal</span>
                <input name="timeline" placeholder="High — board update in 3 weeks" className={fieldClass} />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Top known risk</span>
                <input name="risk" placeholder="Cross-team dependency delays" className={fieldClass} />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Key stakeholders</span>
                <input name="stakeholders" placeholder="Ops lead, Finance partner, Vendor PM" className={fieldClass} />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-medium text-slate-600">Operational context</span>
                <span className="block text-[11px] text-slate-400">
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
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.6)] transition hover:bg-slate-800"
              >
                Create project
              </button>
              <p className="text-[11px] text-slate-400">You can keep refining project context after save.</p>
            </div>
          </form>
        </main>

        <aside className="hidden shrink-0 space-y-3 border-l border-slate-200 bg-white/60 p-4 xl:block">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Command feed</p>
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs leading-relaxed text-slate-400">
            Ask this project anything once context is available.
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 opacity-60">
            <input
              disabled
              placeholder="Ask this project anything…"
              className="flex-1 bg-transparent text-sm text-slate-400 outline-none"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
