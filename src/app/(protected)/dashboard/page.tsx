import Link from "next/link";
import { ModuleShell } from "@/components/pmfreak/module-shell";
import { FirstUserTelemetryEvent } from "@/components/pmfreak/telemetry/first-user-client-events";
import { getAuthUser } from "@/lib/auth";
import { runDashboardApiRuntime } from "@/lib/dashboard/api-runtime";
import { runDashboardConsumptionRuntime } from "@/lib/dashboard/consumption";
import { deriveDashboardPresentation } from "@/lib/dashboard/consumption/dashboard-honest-labels";
import { runDashboardActionCenter } from "@/lib/dashboard/action-center";
import { ExecutiveDashboardActionCenter } from "@/components/dashboard/action-center";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";
import { CommandCenterContextBanner } from "@/components/pmfreak/workspace/command-center-context-banner";
import { resolveCanonicalWorkspace } from "@/lib/workspaces/canonical-workspace-resolver";
import { getCommandCenterById } from "@/lib/workspaces";
import { agentIdleCopy } from "@/lib/command-center/agent-idle-copy";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const params = await searchParams;
  const currentProjectId = params.projectId;

  const user = await getAuthUser();
  const apiResponse = user
    ? runDashboardApiRuntime({ tenantId: user.companyId, userId: user.id, includeMetadata: true })
    : null;
  const dashboardViewModel = runDashboardConsumptionRuntime({ apiResponse });
  // M-01: labeling must reflect whether the metrics really derive from
  // workspace data or from the fallback DTO — never claim "Live" on fallback.
  const presentation = deriveDashboardPresentation(dashboardViewModel);
  const actionCenterReport = runDashboardActionCenter({ dashboardViewModel });
  const withProjectScope = (href: string) =>
    currentProjectId ? `${href}?projectId=${currentProjectId}` : href;

  const workspaceResolution = user ? await resolveCanonicalWorkspace(user.id) : null;
  const commandCenter = workspaceResolution?.workspaceId
    ? await getCommandCenterById(workspaceResolution.workspaceId)
    : null;

  let hasProject = false;
  if (workspaceResolution?.workspaceId) {
    const supabase = createSupabaseServiceRoleClient({
      routeId: "dashboard.page",
      operation: "select",
      reason: "agent_idle_state_check",
      workspaceId: workspaceResolution.workspaceId,
      systemActor: "system",
      actorUserId: user?.id,
    });
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("workspace_id", workspaceResolution.workspaceId)
      .limit(1);
    hasProject = Boolean(projects?.length);
  }

  const idleCopy = agentIdleCopy(Boolean(commandCenter), hasProject);

  return (
    <>
      <FirstUserTelemetryEvent eventType="first_workspace_loaded" />
      <ModuleShell
        title="Summary"
        subtitle="Operational view."
        metrics={[
          { label: "Operational State", value: presentation.operationalStateLabel },
          { label: "Context Memory", value: hasProject ? "Tracking" : "Awaiting signal" },
          { label: "Project Scope", value: currentProjectId ? "Project" : "Portfolio" },
          { label: "Next Action", value: currentProjectId ? "Ready" : "Select scope" },
        ]}
      >
        {commandCenter ? (
          <CommandCenterContextBanner
            name={commandCenter.name}
            commandCenterType={commandCenter.commandCenterType}
            ownerType={commandCenter.ownerType}
            variant="dark"
          />
        ) : (
          <WorkspaceContextBanner lens="Summary" />
        )}
        {idleCopy && (
          <p className="text-xs text-slate-500">{idleCopy}</p>
        )}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Summary</p>
          <p className="mt-2 text-sm text-slate-200">Capture signal, preserve memory, execute next action.</p>
          {currentProjectId ? (
            <p className="mt-2 text-sm text-cyan-200">Project scope is active. Every module now keeps context for {currentProjectId}.</p>
          ) : null}
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          {[
            ["Input Hub", "Capture meeting notes, blockers, dependencies, and escalations so PMFreak can reason with real signal.", "/input-hub"],
            ["Executive", "Instantly see what deserves leadership attention and how to communicate it with confidence.", "/executive"],
            ["Follow-up", "Convert guidance into accountable actions and close execution loops.", "/follow-up-dashboard"],
            ["Project Brief", "Focus the team on the highest instability before it turns into executive fire drills.", "/command-center"],
          ].map(([title, text, href]) => (
            <Link key={title} href={withProjectScope(href as string)} className="rounded-2xl border border-white/10 bg-white/20 p-4 hover:border-cyan-300/40">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-slate-300">{text}</p>
            </Link>
          ))}
        </section>
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{presentation.snapshotHeading}</p>
          {presentation.fallbackNotice && (
            <p className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200" data-testid="dashboard-fallback-notice">
              {presentation.fallbackNotice}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold text-cyan-200">{dashboardViewModel.healthScore}</p>
              <p className="mt-1 text-xs text-slate-400">Health Score</p>
              {dashboardViewModel.healthLabel && (
                <p className="mt-1 text-xs text-cyan-300">{dashboardViewModel.healthLabel}</p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold text-cyan-200">{dashboardViewModel.risksCount}</p>
              <p className="mt-1 text-xs text-slate-400">Risks</p>
              {dashboardViewModel.criticalRisksCount > 0 && (
                <p className="mt-1 text-xs text-red-400">{dashboardViewModel.criticalRisksCount} critical</p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold text-cyan-200">{dashboardViewModel.decisionsCount}</p>
              <p className="mt-1 text-xs text-slate-400">Decisions</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold text-cyan-200">{dashboardViewModel.interventionsCount}</p>
              <p className="mt-1 text-xs text-slate-400">Interventions</p>
            </div>
          </div>
          {dashboardViewModel.executiveSummary && (
            <p className="text-sm text-slate-200">{dashboardViewModel.executiveSummary}</p>
          )}
          {dashboardViewModel.portfolioRecommendation && (
            <p className="text-sm text-cyan-100 border-l-2 border-cyan-400 pl-3">{dashboardViewModel.portfolioRecommendation}</p>
          )}
          {dashboardViewModel.warnings.length > 0 && (
            <ul className="space-y-1">
              {dashboardViewModel.warnings.map((w, i) => (
                <li key={i} className="text-xs text-yellow-300">{w}</li>
              ))}
            </ul>
          )}
          {dashboardViewModel.alertsCount > 0 && (
            <p className="text-xs text-slate-400">{dashboardViewModel.alertsCount} alert{dashboardViewModel.alertsCount !== 1 ? "s" : ""} active</p>
          )}
        </section>
        <ExecutiveDashboardActionCenter report={actionCenterReport} />
      </ModuleShell>
    </>
  );
}
