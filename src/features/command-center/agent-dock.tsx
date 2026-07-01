import type { Agent } from "./types";
import { AgentCard } from "./agent-card";

export function AgentDock({ agents, onSelect }: { agents: Agent[]; onSelect: (agent: Agent) => void }) {
  return (
    <div>
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agents</p>
      <div className="mt-2 space-y-1.5">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
