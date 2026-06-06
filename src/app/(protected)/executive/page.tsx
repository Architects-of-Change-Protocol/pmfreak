import { ExecutiveDashboard } from "@/components/pmfreak/executive/executive-dashboard";
import { requireAuthUser } from "@/lib/auth";
import { ensureUserWorkspace } from "@/lib/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveProject } from "@/lib/resolve-active-project";
import { buildExecutiveSynthesis, type ExecutiveSynthesisSnapshot } from "@/lib/executive-synthesis";
import { getPortfolioIntelligence } from "@/lib/portfolio/repository";
import { PortfolioOverviewPanel } from "@/components/pmfreak/executive/portfolio-overview-panel";
import Link from "next/link";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";

async function safelyBuildSynthesis(
  companyId: string,
  projectId: string | null,
): Promise<{ snapshot: ExecutiveSynthesisSnapshot | null; error: string | null }> {
  try {
    // buildExecutiveSynthesis is company-scoped when projectId is null,
    // or project-narrowed when a valid projectId is provided.
    const snapshot = await buildExecutiveSynthesis(companyId, projectId);
    return { snapshot, error: null };
  } catch (err) {
    console.error("[executive] synthesis failed", { companyId, projectId, error: String(err) });
    return { snapshot: null, error: String(err) };
  }
}

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; projectId?: string }>;
}) {
  const user = await requireAuthUser();
  const workspace = await ensureUserWorkspace(user.id);
  const supabase = await createSupabaseServerClient();
  const params = await searchParams;
  const fromActivation = params.from === "getting-started";

  const { data: projectRows } = await supabase
    .from("projects")
    .select("id,name")
    .eq("workspace_id", workspace.workspaceId)
    .order("created_at", { ascending: false });

  const projectList = (projectRows ?? []) as { id: string; name: string }[];
  const resolution = resolveActiveProject(projectList, params.projectId);

  if (resolution.invalidId) {
    return (
      <main className="space-y-5 pb-8">
        <header className="rounded-3xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-400">Executive</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Executive</h1>
        </header>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <p className="text-sm font-semibold text-amber-200">Project not found in this workspace</p>
          <p className="mt-1 text-xs text-slate-400">
            The project referenced in the URL does not belong to your active workspace or you do not
            have access. The executive view will return to company-wide scope.
          </p>
          <Link
            href="/executive"
            className="mt-3 inline-block rounded-xl border border-indigo-400/40 bg-indigo-400/10 px-4 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-400/15"
          >
            View company-wide synthesis
          </Link>
        </div>
      </main>
    );
  }

  // activeProjectId is null when no projects exist (company-wide synthesis) or when
  // no project was explicitly requested — synthesis runs across all company memory.
  const activeProjectId = resolution.project?.id ?? null;
  const scopeLabel = resolution.project
    ? `Project: ${resolution.project.name}`
    : projectList.length === 0
      ? "Company-wide scope — no projects yet"
      : "Company-wide scope";

  const [{ snapshot, error: synthError }, portfolioResult] = await Promise.all([
    safelyBuildSynthesis(user.companyId, activeProjectId),
    getPortfolioIntelligence(workspace.workspaceId),
  ]);

  if (!snapshot) {
    return (
      <main className="space-y-5 pb-8">
        <header className="rounded-3xl border border-white/8 bg-white/[0.03] p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-400">Executive</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Executive</h1>
        </header>
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
          <p className="text-sm font-semibold text-amber-200">Intelligence synthesis unavailable</p>
          <p className="mt-1 text-xs text-slate-400">
            Executive synthesis is unavailable.
          </p>
          {synthError && (
            <p className="mt-2 rounded border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] text-slate-500">
              {synthError.slice(0, 200)}
            </p>
          )}
          <div className="mt-4 flex gap-3">
            <Link href="/command-center" className="rounded-xl border border-indigo-400/40 bg-indigo-400/10 px-4 py-2 text-xs font-medium text-indigo-200 transition hover:bg-indigo-400/15">
              Go to Command Center
            </Link>
            <Link href="/projects" className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-slate-300">
              View Projects
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const weakest = snapshot.weakestDomains[0];

  return (
    <main className="space-y-6 pb-8">
      <WorkspaceContextBanner lens="Executive" />
      <header className="rounded-2xl border border-slate-700 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Executive</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Executive</h1>
        <p className="mt-2 text-sm text-slate-300">Intervention and escalation view.</p>
        <p className="mt-1 text-xs text-slate-500">{scopeLabel}</p>
      </header>

      {fromActivation ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Escalation probability</p><p className="text-2xl font-semibold text-rose-300">{snapshot.escalationRisk.probabilityScore}%</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Operational health</p><p className="text-2xl font-semibold text-cyan-200">{snapshot.health.overall}%</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Weakest domain</p><p className="text-sm font-semibold text-amber-200">{weakest?.domain.replaceAll("_", " ") ?? "n/a"}</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">PM overload signal</p><p className="text-sm font-semibold">{snapshot.signals.find((s) => s.signalType === "pm_fatigue")?.score ?? 0}%</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Governance gaps</p><p className="text-sm font-semibold">{snapshot.missingInformationWarnings.filter((w) => w.includes("governance") || w.includes("pmo_governance")).length}</p></article>
          <article className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">Intervention recommendations</p><p className="text-sm font-semibold">{snapshot.interventions.length}</p></article>
        </section>
      ) : null}

      <ExecutiveDashboard snapshot={snapshot} />

      {portfolioResult.ok && (
        <PortfolioOverviewPanel
          summary={portfolioResult.data.summary}
          projects={portfolioResult.data.projects}
          bottlenecks={portfolioResult.data.bottlenecks}
          dependencyRisks={portfolioResult.data.dependencyRisks}
          executiveAttention={portfolioResult.data.executiveAttention}
        />
      )}
    </main>
  );
}
