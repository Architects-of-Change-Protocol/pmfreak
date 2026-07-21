import { WorkspaceOnboardingPanel } from "@/components/pmfreak/onboarding/workspace-onboarding-panel";
import { WorkspaceContextBanner } from "@/components/pmfreak/workspace/workspace-context-banner";

/**
 * Dedicated home for the guided workspace setup checklist. This is the
 * persistent place to reopen the guide after collapsing or dismissing it on
 * the dashboard. Progress shown here is derived from real workspace data.
 */
export default function WorkspaceSetupStatusPage() {
  return (
    <main className="space-y-6 pb-8">
      <WorkspaceContextBanner lens="Workspace Setup" />
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-600">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Workspace Setup</h1>
        <p className="mt-2 text-sm text-slate-700">
          Activation progress for this workspace, derived from its real projects, work items and
          activity.
        </p>
      </header>
      <WorkspaceOnboardingPanel surface="setup" />
    </main>
  );
}
