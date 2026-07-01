import type { Agent } from "./types";
import { AgentCard } from "./agent-card";
import { PreviewTag } from "./status-badge";

export function AgentDock({ agents, onSelect, preview = false }: { agents: Agent[]; onSelect: (agent: Agent) => void; preview?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agents</p>
        {preview && <PreviewTag />}
      </div>
      <div className="mt-2 space-y-1.5">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
