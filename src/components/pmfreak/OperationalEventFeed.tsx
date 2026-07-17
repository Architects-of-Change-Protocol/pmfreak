"use client";

import { useState } from "react";

type EventSeverity = "info" | "warning" | "alert" | "critical";

export type OperationalEvent = {
  id: string;
  message: string;
  module: string;
  severity: EventSeverity;
  ageLabel: string;
};

const SEVERITY_STYLES: Record<EventSeverity, { dot: string; module: string }> = {
  info:     { dot: "bg-slate-400",  module: "text-slate-500"  },
  warning:  { dot: "bg-amber-400",  module: "text-amber-600"  },
  alert:    { dot: "bg-orange-400", module: "text-orange-600" },
  critical: { dot: "bg-red-400",    module: "text-red-600"    },
};

const DEMO_EVENTS: OperationalEvent[] = [
  { id: "e1", message: "Stakeholder sentiment declined — Titan rollout", module: "Stakeholders", severity: "warning",  ageLabel: "14m" },
  { id: "e2", message: "2 follow-ups unresolved for 9+ days",            module: "Follow-ups",   severity: "alert",    ageLabel: "1h"  },
  { id: "e3", message: "Sponsor engagement inactive for 14 days",        module: "Stakeholders", severity: "critical", ageLabel: "8h"  },
  { id: "e4", message: "Meeting accountability gap emerging",             module: "Meetings",     severity: "warning",  ageLabel: "12h" },
  { id: "e5", message: "Timeline drift detected — Security lane",         module: "Projects",     severity: "alert",    ageLabel: "1d"  },
];

export function OperationalEventFeed({
  events = DEMO_EVENTS,
  maxVisible = 3,
}: {
  events?: OperationalEvent[];
  maxVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, maxVisible);
  const overflow = events.length - maxVisible;

  return (
    <div className="space-y-1">
      {visible.map((event) => {
        const s = SEVERITY_STYLES[event.severity];
        return (
          <div
            key={event.id}
            className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 transition-colors hover:border-slate-200 hover:bg-white"
          >
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dot} motion-safe:animate-pulse`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] leading-snug text-slate-700">{event.message}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`text-[10px] font-medium ${s.module}`}>{event.module}</span>
                <span className="text-[10px] text-zinc-300">·</span>
                <span className="text-[10px] text-zinc-400">{event.ageLabel}</span>
              </div>
            </div>
          </div>
        );
      })}
      {overflow > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1 text-center text-[10px] uppercase tracking-[0.12em] text-zinc-300 transition-colors hover:text-zinc-500"
        >
          {expanded ? "Collapse" : `+${overflow} more signals`}
        </button>
      )}
    </div>
  );
}
