import { AgentRun } from "../features/AgentRun";

/** Agent Run view (08-ai-interaction-patterns.md §4). */
export function AgentRunScreen({ workspaceId, runId }: { workspaceId: string; runId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Agent Run</h1>
      </header>
      <AgentRun workspaceId={workspaceId} runId={runId} />
    </div>
  );
}
