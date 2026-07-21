import { requireAuthUser } from "@/lib/auth";
import { resolvePreferredWorkspace } from "@/lib/workspaces/preferred-workspace";
import { DailyExecutionClient } from "@/components/pmfreak/execution/daily-execution-client";

/**
 * Daily Execution Workspace — the canonical daily-driver task surface
 * (see docs/architecture/daily-execution-workspace.md for why this is a
 * new route rather than repurposing /command-center or /follow-up-dashboard:
 * Command Center is the intelligence/recommendation console, Follow-up is
 * a memory-based delivery summary, and neither is a cross-project task
 * list with quick actions).
 */
export default async function DailyExecutionPage() {
  const user = await requireAuthUser();
  const workspaceResolution = await resolvePreferredWorkspace(user.id);
  const canEdit = workspaceResolution.role !== null && workspaceResolution.role !== "viewer";

  return (
    <main className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl backdrop-blur-xl md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Daily Execution</h1>
        <p className="mt-1 text-sm text-slate-600">Focus on the work that needs attention now.</p>
      </div>
      <DailyExecutionClient canEdit={canEdit} />
    </main>
  );
}
