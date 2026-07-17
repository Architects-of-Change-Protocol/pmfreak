"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EventType =
  | "blocker_introduced"
  | "escalation_ignored"
  | "stakeholder_pressure"
  | "pm_overload"
  | "exec_intervention"
  | "dependency_resolved"
  | "recovery_activated";

type DemoEvent = {
  id: string;
  day: number;
  type: EventType;
  title: string;
  effect: {
    executionRisk: number;
    pressure: number;
    coordination: number;
    drift: number;
    recovery: number;
  };
};

type DemoScript = {
  key: string;
  label: string;
  sequence: number[];
};

const baseState = { executionRisk: 42, pressure: 38, coordination: 46, drift: 24, recovery: 6 };
const projects = ["Atlas ERP", "Mercury Migration", "Helios Data", "Nexus GTM"];

const timeline: DemoEvent[] = [
  { id: "evt-1", day: 1, type: "blocker_introduced", title: "Vendor API blocker introduced on reporting dependency.", effect: { executionRisk: 10, pressure: 2, coordination: -6, drift: 7, recovery: 0 } },
  { id: "evt-2", day: 2, type: "escalation_ignored", title: "Escalation ignored for 24h due to executive travel.", effect: { executionRisk: 8, pressure: 7, coordination: -4, drift: 8, recovery: 0 } },
  { id: "evt-3", day: 3, type: "stakeholder_pressure", title: "CFO requests launch certainty; pressure rises across leadership.", effect: { executionRisk: 5, pressure: 15, coordination: -2, drift: 6, recovery: 0 } },
  { id: "evt-4", day: 4, type: "pm_overload", title: "Primary PM overloaded with 17 unresolved action items.", effect: { executionRisk: 7, pressure: 6, coordination: -7, drift: 6, recovery: 0 } },
  { id: "evt-5", day: 5, type: "exec_intervention", title: "Executive intervention triggered with explicit owner reassignment.", effect: { executionRisk: -8, pressure: -4, coordination: 10, drift: -6, recovery: 12 } },
  { id: "evt-6", day: 6, type: "dependency_resolved", title: "Critical dependency deadlock resolved by architecture lead.", effect: { executionRisk: -9, pressure: -4, coordination: 12, drift: -8, recovery: 16 } },
  { id: "evt-7", day: 7, type: "recovery_activated", title: "Delivery recovery sequence activated with daily war-room cadence.", effect: { executionRisk: -12, pressure: -7, coordination: 14, drift: -9, recovery: 18 } },
];

const scripts: DemoScript[] = [
  { key: "Status Meeting Recovery", label: "Status Meeting Recovery", sequence: [1, 2, 5, 6, 7] },
  { key: "Dependency Delay Spiral", label: "Dependency Delay Spiral", sequence: [1, 2, 3, 4] },
  { key: "Stakeholder Pressure Cycle", label: "Stakeholder Pressure Cycle", sequence: [2, 3, 4, 5] },
  { key: "Delivery Recovery Plan", label: "Delivery Recovery Plan", sequence: [1, 3, 5, 6, 7] },
  { key: "Portfolio Alignment Check", label: "Portfolio Alignment Check", sequence: [1, 2, 3, 4, 6] },
];

const tickerMessages = [
  "Stakeholder questions increasing",
  "Project risk elevated",
  "Leadership update needed",
  "Recovery plan started",
  "Blocker coordination resolved",
  "Delivery confidence improving",
];

const commentaryLibrary: Record<EventType, string> = {
  blocker_introduced: "Delivery instability spreading across coordination chain.",
  escalation_ignored: "Operational silence after escalation is increasing executive risk.",
  stakeholder_pressure: "Stakeholder volatility is amplifying escalation chain instability.",
  pm_overload: "PM overload is degrading follow-through and increasing delivery drift.",
  exec_intervention: "Intervention engine recommends immediate owner realignment and cadence reset.",
  dependency_resolved: "Recovery sequence partially successful after dependency unblocking.",
  recovery_activated: "Stakeholder volatility stabilized after intervention.",
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const controlButtonClass = "rounded-full border border-slate-200 px-3 py-1.5";
const scriptButtonClass = "rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs";

export function InteractiveDemoExperience() {
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [script, setScript] = useState<DemoScript>(scripts[0]);
  const [executiveMode, setExecutiveMode] = useState(false);
  const [warRoomMode, setWarRoomMode] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setTickerIndex((idx) => (idx + 1) % tickerMessages.length);
    }, 2300);
    return () => clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setDay((d) => {
        const idx = script.sequence.indexOf(d);
        const nextIdx = idx >= 0 ? (idx + 1) % script.sequence.length : 0;
        return script.sequence[nextIdx] ?? d;
      });
    }, 2800);
    return () => clearInterval(interval);
  }, [playing, script]);

  const activeTimeline = useMemo(() => {
    const progressed = timeline.filter((event) => event.day <= day);
    return progressed.sort((a, b) => a.day - b.day);
  }, [day]);

  const intelligence = activeTimeline.reduce(
    (acc, event) => ({
      executionRisk: clamp(acc.executionRisk + event.effect.executionRisk),
      pressure: clamp(acc.pressure + event.effect.pressure),
      coordination: clamp(acc.coordination + event.effect.coordination),
      drift: clamp(acc.drift + event.effect.drift),
      recovery: clamp(acc.recovery + event.effect.recovery),
    }),
    baseState,
  );

  const orgHealth = clamp(100 - Math.round((intelligence.executionRisk + intelligence.pressure + intelligence.drift) / 3));
  const escalationProbability = clamp(Math.round((intelligence.executionRisk * 0.6 + intelligence.pressure * 0.4)));
  const interventionEffectiveness = clamp(Math.round(intelligence.recovery * 0.8 + intelligence.coordination * 0.2));

  const latestEvent = activeTimeline[activeTimeline.length - 1];
  const latestCommentary = latestEvent
    ? commentaryLibrary[latestEvent.type]
    : "Project baseline loaded. PMFreak is tracking project health and stakeholder alignment.";

  return (
    <main className="min-h-screen bg-[#090c13] px-5 py-8 text-slate-900 md:px-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-[#121926] via-[#111525] to-white p-6 shadow-[0_0_80px_rgba(34,211,238,0.1)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">PMFreak interactive demo</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-black tracking-tight md:text-5xl">A realistic week in a PM&apos;s world</h1>
            <div className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]">live demo</div>
          </div>
          <p className="mt-4 max-w-4xl text-sm text-slate-900/75">Live project heartbeat, multi-project instability simulation, explainable interventions, and recovery telemetry for PM teams.</p>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-cyan-900">
            <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-cyan-300" />
            {tickerMessages[tickerIndex]} · {latestCommentary}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[{ k: "Org Health", v: orgHealth }, { k: "Escalation Probability", v: escalationProbability }, { k: "Pressure Score", v: intelligence.pressure }, { k: "Delivery Confidence", v: clamp(100 - intelligence.executionRisk) }, { k: "Intervention Effectiveness", v: interventionEffectiveness }, { k: "PM Overload", v: clamp(intelligence.drift + 12) }].map((metric) => (
            <article key={metric.k} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-900/55">{metric.k}</p>
              <p className="mt-1 text-3xl font-black">{metric.v}</p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-50"><div className="h-1.5 rounded-full bg-cyan-300/80 transition-all duration-700" style={{ width: `${metric.v}%` }} /></div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
          <article className="rounded-2xl border border-slate-200 bg-[#0f1421] p-5">
            <h2 className="text-lg font-black uppercase tracking-[0.14em] text-slate-900/80">Project timeline replay mode</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button onClick={() => setPlaying((p) => !p)} className={controlButtonClass}>{playing ? "Pause" : "Play"}</button>
              <button onClick={() => setDay((d) => Math.max(0, d - 1))} className={controlButtonClass}>Jump -1</button>
              <button onClick={() => setDay((d) => Math.min(7, d + 1))} className={controlButtonClass}>Jump +1</button>
              {scripts.map((s) => <button key={s.key} onClick={() => { setScript(s); setDay(s.sequence[0] ?? 0); }} className={scriptButtonClass}>{s.label}</button>)}
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {activeTimeline.length === 0 ? <li className="text-slate-900/50">Awaiting first project update.</li> : activeTimeline.map((event) => <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-3"><span className="font-bold text-cyan-700">Day {event.day}:</span> {event.title}</li>)}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-[#0f1421] p-5">
            <h2 className="text-lg font-black">Why PMFreak suggested action</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-900/80">
              <p><strong>Confidence:</strong> 92% · Based on 14 project signals.</p>
              <p><strong>Rationale:</strong> Delayed responses + overloaded PM + cross-team blockers.</p>
              <p><strong>Risk summary:</strong> Executive response latency exceeded tolerance band by 19 hours.</p>
              <p><strong>Signals used:</strong> standup cadence, unresolved blocker count, stakeholder response lag, confidence decay.</p>
            </div>
            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-950">High-confidence suggestion: protect the critical path and rebalance team workload.</div>
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className={`rounded-2xl border border-slate-200 p-5 ${executiveMode ? "bg-gradient-to-b from-[#14203a] to-[#101622]" : "bg-[#101622]"}`}>
            <div className="flex items-center justify-between"><h3 className="text-xl font-black">Prepare Update Mode</h3><button onClick={() => setExecutiveMode((v) => !v)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">{executiveMode ? "Exit" : "Enter"}</button></div>
            <p className="mt-2 text-sm text-slate-900/75">A concise leadership-ready view with project health, risks, and next steps.</p>
          </article>
          <article className={`rounded-2xl border border-slate-200 p-5 ${warRoomMode ? "bg-gradient-to-b from-[#2a161f] to-[#131720]" : "bg-[#101622]"}`}>
            <div className="flex items-center justify-between"><h3 className="text-xl font-black">Team Coordination Mode</h3><button onClick={() => setWarRoomMode((v) => !v)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">{warRoomMode ? "Exit" : "Enter"}</button></div>
            <p className="mt-2 text-sm text-slate-900/75">Focused view for blockers, owners, and follow-through during delivery pressure.</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {projects.map((project, idx) => (
            <article key={project} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-black">{project}</h4>
              <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-900/55">Project pressure {clamp(intelligence.pressure - idx * 6)}</p>
              <p className="mt-2 text-sm text-slate-900/75">Resource collision with {(projects[(idx + 1) % projects.length])}; leadership priority conflict detected.</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-[#0f1421] p-6">
          <h2 className="text-xl font-black">Project workflow integrations</h2>
          <p className="mt-2 text-sm text-slate-900/75">Live integrations · Teams/Slack escalation ingestion · Jira telemetry · Portfolio intelligence · Autonomous AI PM agents.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-full border border-slate-200 px-4 py-2 font-bold" href="/signup">Start Free</Link>
            <Link className="rounded-full border border-slate-200 px-4 py-2 font-bold" href="/pricing">See Pricing</Link>
            <Link className="rounded-full border border-slate-200 px-4 py-2 font-bold" href="/login">Continue</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
