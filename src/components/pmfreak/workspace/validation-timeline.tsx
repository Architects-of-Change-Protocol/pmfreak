import type { ValidationTrace } from "@/lib/workspace/runtime-validation";

type TimelineEvent = {
  id: string;
  label: string;
  timestamp: number;
  level: "info" | "signal" | "milestone";
};

const CONFIDENCE_ORDER = ["low", "building", "credible", "high"] as const;

function deriveEvents(traces: ValidationTrace[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (let i = 0; i < traces.length; i++) {
    const trace = traces[i];
    const prev = traces[i - 1];

    events.push({
      id: `${trace.traceId}-signal`,
      label: `Signal detected${trace.triggerSummary ? `: ${trace.triggerSummary.slice(0, 48)}` : ""}`,
      timestamp: trace.timestamp,
      level: "signal",
    });

    if (trace.continuitySignals.length > 0 && i > 0) {
      events.push({
        id: `${trace.traceId}-continuity`,
        label: "Continuity adapted",
        timestamp: trace.timestamp,
        level: "info",
      });
    }

    if (trace.reasoningPath.includes("Executive synthesis")) {
      events.push({
        id: `${trace.traceId}-executive`,
        label: "Executive reasoning activated",
        timestamp: trace.timestamp,
        level: "milestone",
      });
    }

    if (
      prev &&
      CONFIDENCE_ORDER.indexOf(trace.confidence) > CONFIDENCE_ORDER.indexOf(prev.confidence)
    ) {
      events.push({
        id: `${trace.traceId}-elevation`,
        label: `Confidence elevated to ${trace.confidence}`,
        timestamp: trace.timestamp,
        level: "milestone",
      });
    }
  }

  return events.slice(-12);
}

const LEVEL_STYLES: Record<TimelineEvent["level"], string> = {
  info: "text-slate-400",
  signal: "text-slate-500",
  milestone: "text-violet-400/70",
};

const DOT_STYLES: Record<TimelineEvent["level"], string> = {
  info: "bg-zinc-700",
  signal: "bg-slate-600",
  milestone: "bg-violet-500/50",
};

type Props = {
  traces: ValidationTrace[];
};

export function ValidationTimeline({ traces }: Props) {
  const events = deriveEvents(traces);

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-3 text-xs">
      <summary className="cursor-pointer select-none text-[9px] uppercase tracking-[0.28em] text-zinc-400">
        Session Timeline
      </summary>
      {events.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-300">No runtime events yet</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-2">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_STYLES[event.level]}`} />
              <span className={`leading-tight ${LEVEL_STYLES[event.level]}`}>{event.label}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
