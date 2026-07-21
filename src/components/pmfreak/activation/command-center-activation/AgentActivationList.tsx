import { motion } from "framer-motion";
import { AGENT_META, type AgentId } from "@/lib/pmo/pmo-tenant-types";
import type { AgentConnectionStatus } from "./types";

const STATUS_COPY: Record<AgentConnectionStatus, string> = {
  dormant: "Waiting",
  connecting: "Connecting…",
  online: "Online",
};

/**
 * Renders only the agents the user actually enabled in Step 4 — never a fixed
 * roster. Each connects individually (dormant -> connecting -> online) rather
 * than appearing all at once.
 */
export function AgentActivationList({
  enabledAgentIds,
  agentStatuses,
}: {
  enabledAgentIds: AgentId[];
  agentStatuses: Partial<Record<AgentId, AgentConnectionStatus>>;
}) {
  if (enabledAgentIds.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-zinc-500">
        No agents were enabled — you can turn these on later from Command Center settings.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {enabledAgentIds.map((agentId) => {
        const meta = AGENT_META[agentId];
        const status = agentStatuses[agentId] ?? "dormant";
        return (
          <motion.div
            key={agentId}
            initial={{ opacity: 0.4, y: 4 }}
            animate={{ opacity: status === "dormant" ? 0.4 : 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-300 ${
              status === "online"
                ? "border-cyan-300/40 bg-cyan-400/[0.06]"
                : status === "connecting"
                  ? "border-cyan-200/60 bg-cyan-400/[0.03]"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${
                    status === "online"
                      ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
                      : status === "connecting"
                        ? "animate-pulse bg-cyan-300"
                        : "bg-zinc-300"
                  }`}
                />
                <span className={`truncate text-sm font-semibold ${status === "dormant" ? "text-zinc-400" : "text-slate-900"}`}>
                  {meta.label}
                </span>
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.14em] ${
                status === "online"
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-700"
                  : status === "connecting"
                    ? "border-cyan-300/40 text-cyan-600"
                    : "border-zinc-200 text-zinc-400"
              }`}
            >
              {STATUS_COPY[status]}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
