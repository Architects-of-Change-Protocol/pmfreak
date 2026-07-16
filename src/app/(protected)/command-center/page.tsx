import Link from "next/link";
import { activateContextAction } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";
import { ensureUserWorkspace } from "@/lib/workspaces";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { listPmosWithProjects } from "@/lib/pmos/pmo-service";
import { CommandCenterClient } from "@/features/command-center/command-center-client";
import { CommandCenterEmptyState } from "@/features/command-center/command-center-empty-state";
import { resolveActiveProject } from "@/lib/resolve-active-project";
import { getCompanySubscription } from "@/lib/billing";
import { getPlanCapabilities } from "@/lib/feature-gates";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";
import { loadLatestOperationalGovernanceBrief } from "@/lib/projects/first-insight";
import { noteFounderCommandCenterVisit } from "@/lib/founder-program/checkpoints";

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; projectId?: string; briefGeneration?: string; error?: string }>;
}) {
  const user = await requireAuthUser();
  // Honor the user's active-workspace selection; fall back to the bootstrap
  // workspace for accounts that have never switched.
  const preferred = await resolvePreferredWorkspace(user.id);
  const workspace = preferred.workspaceId
    ? { workspaceId: preferred.workspaceId }
    : await ensureUserWorkspace(user.id);
  const workspace = await ensureUserWorkspace(user.id);
  // Founder Circle onboarding evidence — flag-gated no-op for everyone else,
  // and internally fail-silent so it can never affect this page.
  await noteFounderCommandCenterVisit(user.id);
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
      <div className="space-y-4">
        <WorkspaceContextBanner lens="Command Center" variant="light" />
        <CommandCenterEmptyState activateAction={activateContextAction} errorMessage={params.error} />
      </div>
    );
  }

  const projectList = (projects ?? []) as { id: string; name: string }[];
  const resolution = resolveActiveProject(projectList, params.projectId);

  if (resolution.invalidId) {
    return (
      <div className="space-y-4">
        <WorkspaceContextBanner lens="Command Center" variant="light" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6">
          <p className="text-sm font-semibold text-amber-900">Project not found in this workspace</p>
          <p className="mt-1 text-xs text-amber-700/80">
            The project referenced in the URL does not belong to your active workspace or you do not have
            access. Select a project below or navigate to the Command Center without a project filter.
          </p>
          <a
            href="/command-center"
            className="mt-3 inline-block rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset to default project
          </a>
        </div>
      </div>
    );
  }

  const initialBrief = await loadLatestOperationalGovernanceBrief(resolution.project!.id, supabase);

  // Operations strip: the Command Center is the workspace's operations
  // console, so it surfaces the full PMO portfolio, not just one project.
  const pmoPortfolio = await listPmosWithProjects(workspace.workspaceId);
  const portfolioProjects = pmoPortfolio.reduce((sum, pmo) => sum + pmo.projects.length, 0);
  const portfolioActive = pmoPortfolio.reduce((sum, pmo) => sum + pmo.projects.filter((p) => p.status === "active").length, 0);

  return (
    <div className="space-y-4">
      <WorkspaceContextBanner lens="Command Center" variant="light" />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
        <p className="text-xs text-slate-600">
          Operating across <span className="font-semibold text-slate-900">{pmoPortfolio.length}</span> PMO{pmoPortfolio.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-slate-900">{portfolioProjects}</span> project{portfolioProjects === 1 ? "" : "s"} ({portfolioActive} active)
        </p>
        <div className="flex gap-2 text-xs font-medium">
          <Link href="/pmos" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50">Manage PMOs</Link>
          <Link href="/chat" className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50">Workspace Chat</Link>
        </div>
      </div>
      <CommandCenterClient
        key={resolution.project!.id}
        firstRun={fromOnboarding}
        projectId={resolution.project!.id}
        projectName={resolution.project!.name}
        workspaceId={workspace.workspaceId}
        projects={projectList}
        companyName={user.companyName}
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
