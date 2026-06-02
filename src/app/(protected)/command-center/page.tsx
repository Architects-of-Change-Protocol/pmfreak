import { activateContextAction } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";
import { ensureUserWorkspace } from "@/lib/workspaces";
import { CommandCenterClient } from "@/features/command-center/command-center-client";
import { GuidedEmptyState } from "@/components/pmfreak/onboarding/GuidedEmptyState";
import { resolveActiveProject } from "@/lib/resolve-active-project";
import { getCompanySubscription } from "@/lib/billing";
import { getPlanCapabilities } from "@/lib/feature-gates";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";
import { loadLatestOperationalGovernanceBrief } from "@/lib/projects/first-insight";

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; projectId?: string; briefGeneration?: string }>;
}) {
  const user = await requireAuthUser();
  const workspace = await ensureUserWorkspace(user.id);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const fromOnboarding = params.from === "onboarding";
  const subscription = await getCompanySubscription(user.companyId);
  const capabilities = getPlanCapabilities(subscription.plan);
  const briefGenerationFailed = params.briefGeneration === "failed";

  const { data: projects } = await supabase
    .from("projects")
    .select("id,name")
    .eq("workspace_id", workspace.workspaceId)
    .order("created_at", { ascending: false });

  if ((projects ?? []).length === 0) {
    return (
      <div className="space-y-5 pb-10">
        <WorkspaceContextBanner lens="Execution Coordination Lens" />
        <section className="rounded-3xl border border-indigo-400/25 bg-indigo-400/[0.06] p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Execution Coordination Lens</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            This lens is generated from workspace context. Add a project to unlock execution coordination telemetry in this view.
          </p>
          <form action={activateContextAction} className="mt-8 space-y-5 rounded-2xl border border-white/8 bg-white/[0.04] p-6">

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">Initiative name</span>
                  <span className="block text-[11px] text-slate-600">The initiative PMFreak will begin monitoring</span>
                  <input
                    required
                    name="name"
                    placeholder="Q3 Enterprise Platform Rollout"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">Customer / sponsor</span>
                  <span className="block text-[11px] text-slate-600">Executive accountable for delivery</span>
                  <input
                    name="sponsor"
                    placeholder="VP Operations"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">Current phase</span>
                  <span className="block text-[11px] text-slate-600">Where the initiative sits in its lifecycle</span>
                  <input
                    name="phase"
                    placeholder="Pilot execution"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-slate-300">Timeline pressure</span>
                  <span className="block text-[11px] text-slate-600">PMFreak calibrates urgency from this signal</span>
                  <input
                    name="timeline"
                    placeholder="High — board update in 3 weeks"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Top known risk</span>
                  <input
                    name="risk"
                    placeholder="Cross-team dependency delays"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Key stakeholders</span>
                  <input
                    name="stakeholders"
                    placeholder="Ops lead, Finance partner, Vendor PM"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>

                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-medium text-slate-300">Operational context</span>
                  <span className="block text-[11px] text-slate-600">
                    Describe the initiative PMFreak should begin monitoring — objectives, constraints, pressure
                    points. More context improves signal accuracy.
                  </span>
                  <textarea
                    name="description"
                    rows={5}
                    placeholder="Add initiative context, objectives, constraints, and current pressure points."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-indigo-400/50 focus:bg-indigo-400/[0.04]"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button type="submit" className="rounded-xl border border-indigo-400/50 bg-indigo-500/20 px-6 py-2.5 text-sm font-semibold text-slate-100 shadow-[0_0_24px_-8px_rgba(99,102,241,0.5)] transition hover:bg-indigo-500/30">
                  Add project context
                </button>
                <p className="text-[11px] text-slate-500">You can keep refining workspace context after save.</p>
              </div>
            </form>
        </section>

        {/* Supporting context */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GuidedEmptyState
            signal="Agents standing by"
            title="Four intelligence layers are waiting"
            description="Once you activate a context, PMFreak's agent network begins monitoring your initiative across four operational dimensions simultaneously."
            why="PMFreak will begin sensing stakeholder confidence drift once interactions are logged. Operational risk telemetry becomes more accurate as meetings are ingested."
            actions={[
              { label: "Execution Risk monitor", sublabel: "tracks delivery confidence and blocker accumulation" },
              { label: "Stakeholder Dynamics monitor", sublabel: "detects alignment drift and political risk" },
              { label: "Meeting Debt monitor", sublabel: "surfaces follow-up pressure and accountability gaps" },
              { label: "Follow-up Pressure monitor", sublabel: "prevents commitment slippage" },
            ]}
          />

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">What happens next</p>
            <ol className="mt-4 space-y-3">
              {[
                { n: "01", text: "PMFreak creates your operational context and calibrates risk telemetry." },
                { n: "02", text: "Agents begin monitoring risk, stakeholders, meetings, and follow-ups." },
                { n: "03", text: "The Command Center becomes live — signals populate in real time." },
                { n: "04", text: "Recommended actions guide your first operational interventions." },
              ].map(({ n, text }) => (
                <li key={n} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold text-indigo-400">{n}</span>
                  <p className="text-sm text-slate-400">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const projectList = (projects ?? []) as { id: string; name: string }[];
  const resolution = resolveActiveProject(projectList, params.projectId);

  if (resolution.invalidId) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
        <p className="text-sm font-semibold text-amber-200">Project not found in this workspace</p>
        <p className="mt-1 text-xs text-slate-400">
          The project referenced in the URL does not belong to your active workspace or you do not have
          access. Select a project below or navigate to the Command Center without a project filter.
        </p>
        <a
          href="/command-center"
          className="mt-3 inline-block rounded-xl border border-indigo-400/40 bg-indigo-400/10 px-4 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-400/15"
        >
          Reset to default project
        </a>
      </div>
    );
  }

  const initialBrief = await loadLatestOperationalGovernanceBrief(resolution.project!.id, supabase);

  return (
    <div className="space-y-4">
      <WorkspaceContextBanner lens="Execution Coordination Lens" />
      <CommandCenterClient
        firstRun={fromOnboarding}
        projectId={resolution.project!.id}
        projectName={resolution.project!.name}
        workspaceId={workspace.workspaceId}
        projects={projectList}
        role={user.role}
        onboardingCompleted={user.onboardingCompleted}
        planTier={subscription.plan}
        canUseAdvancedAi={capabilities.advanced_ai_actions}
        canUsePortfolioMemory={capabilities.organizational_memory}
        canUseGovernanceDirectives={capabilities.governance_directives}
        initialBrief={initialBrief}
        briefGenerationFailed={briefGenerationFailed && !initialBrief}
      />
    </div>
  );
}
