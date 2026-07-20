import { AgentRegistry } from "../features/AgentRegistry";

/** Agent Center screen (03-screen-catalog.md §12) — Agent Foundation. */
export function AgentRegistryScreen({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">Agents</h1>
        <p className="text-sm text-slate-400">Governed capabilities active for this workspace, never a chatbot persona.</p>
      </header>
      <AgentRegistry workspaceId={workspaceId} projectId={projectId} />
    </div>
  );
}
