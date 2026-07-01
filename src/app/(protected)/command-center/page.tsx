import { activateContextAction } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/auth";
import { ensureUserWorkspace } from "@/lib/workspaces";
import { CommandCenterClient } from "@/features/command-center/command-center-client";
import { CommandCenterEmptyState } from "@/features/command-center/command-center-empty-state";
import { resolveActiveProject } from "@/lib/resolve-active-project";
import { getCompanySubscription } from "@/lib/billing";
import { getPlanCapabilities } from "@/lib/feature-gates";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";
import { loadLatestOperationalGovernanceBrief } from "@/lib/projects/first-insight";

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; projectId?: string; briefGeneration?: string; error?: string }>;
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

  return (
    <div className="space-y-4">
      <WorkspaceContextBanner lens="Command Center" variant="light" />
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
