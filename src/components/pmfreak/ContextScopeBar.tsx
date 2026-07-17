"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { OPERATIONAL_FLOW } from "@/features/navigation/module-registry";
import { LiveSignalPill } from "./LiveSignalPill";

type UserProject = { id: string; name: string };

export function ContextScopeBar({
  projects,
  projectId,
  onProjectChange,
  loading,
  error,
  scopeLabel,
  hasProjects,
}: {
  projects: UserProject[];
  projectId: string;
  onProjectChange: (id: string) => void;
  loading: boolean;
  error: string | null;
  scopeLabel: string;
  hasProjects: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [time, setTime] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
      setDate(now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 backdrop-blur-xl md:px-5 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
        {/* Left: scope selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Scope</span>
          <select
            value={projectId}
            onChange={(e) => {
              const id = e.target.value;
              onProjectChange(id);
              // Preserve existing query params — only update/remove projectId.
              const params = new URLSearchParams(window.location.search);
              if (id) {
                params.set("projectId", id);
              } else {
                params.delete("projectId");
              }
              const query = params.toString();
              router.push(`${pathname}${query ? `?${query}` : ""}`);
            }}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
          >
            <option value="">Portfolio scope</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {!loading && <span className="hidden text-xs text-zinc-400 sm:inline">{scopeLabel}</span>}
          {loading && <span className="text-xs text-zinc-400">Loading…</span>}
        </div>

        {/* Right: AI status + clock */}
        <div className="flex items-center gap-3">
          {hasProjects ? (
            <LiveSignalPill label="AI Active" variant="active" />
          ) : (
            <LiveSignalPill label="Agents Standby" variant="standby" />
          )}
          {date && time && (
            <span className="hidden text-[11px] tabular-nums text-zinc-400 md:inline">
              {date} · {time}
            </span>
          )}
        </div>
      </div>

      {/* Status lines */}
      {error && <p className="mt-2 text-xs text-amber-300/90">{error}</p>}
      {!loading && !error && !hasProjects && (
        <p className="mt-2 text-xs text-cyan-300/70">
          No operational contexts yet —{" "}
          <Link href="/command-center" className="underline underline-offset-2 hover:text-cyan-800">
            activate one
          </Link>{" "}
          to unlock full AI telemetry.
        </p>
      )}

      {/* Operational flow breadcrumb */}
      {hasProjects && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {OPERATIONAL_FLOW.map((step, idx) => (
            <span key={step} className="text-[10px] text-zinc-300">
              {step}
              {idx < OPERATIONAL_FLOW.length - 1 && (
                <span className="ml-1 text-zinc-200">→</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
