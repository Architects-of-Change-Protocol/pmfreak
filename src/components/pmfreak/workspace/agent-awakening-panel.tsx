import type { AgentCluster, AwakeningState } from "@/lib/workspace/awakening-state";
import { deriveImprintReflection } from "@/lib/workspace/imprint-confidence";
import type { ImprintConfidence } from "@/lib/workspace/imprint-confidence";
import type { PMOperationalImprint } from "@/lib/workspace/operational-imprint-profile";

const CLUSTER_LABELS: Record<AgentCluster, string> = {
  context: "Context orientation",
  memory: "Memory seeding",
  delivery: "Delivery signal analysis",
  stakeholders: "Stakeholder inference",
  risk: "Risk sensing",
  executive: "Executive synthesis",
  portfolio: "Portfolio intelligence",
};

const STAGE_SUMMARY: Record<AwakeningState["stage"], string> = {
  dormant: "Core systems on standby",
  initializing: "Context orientation active",
  orienting: "Delivery signals acquiring",
  engaged: "Stakeholder inference online",
  expanded: "Executive synthesis available",
  "fully-operational": "Full operational runtime active",
};

type Props = {
  state: AwakeningState;
  imprintProfile?: PMOperationalImprint;
  imprintConfidence?: ImprintConfidence;
};

export function AgentAwakeningPanel({ state, imprintProfile, imprintConfidence }: Props) {
  const reflection =
    imprintProfile && imprintConfidence
      ? deriveImprintReflection(imprintProfile, imprintConfidence)
      : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="mb-2 text-[9px] uppercase tracking-[0.28em] text-zinc-400">Agent Runtime</p>
      <p className="mb-3 text-[11px] text-slate-500">{STAGE_SUMMARY[state.stage]}</p>
      {state.awakenedAgents.length > 0 ? (
        <ul className="space-y-1.5">
          {state.awakenedAgents.map((cluster) => (
            <li key={cluster} className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="h-1 w-1 shrink-0 rounded-full bg-emerald-400/50" />
              {CLUSTER_LABELS[cluster]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-zinc-300">Awaiting operational signal</p>
      )}
      {reflection ? (
        <p className="mt-2.5 text-[10px] text-indigo-400/70">{reflection}</p>
      ) : null}
    </div>
  );
}
