import Link from "next/link";
import { requireAuthUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AgentCard } from "@/components/pmfreak/agent-card";
import { createProjectAction } from "./actions";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
};

const agents = [
  {
    name: "Risk Agent",
    purpose: "Continuously senses blockers, delivery volatility, and execution instability before timelines fracture.",
    signals: ["Timeline drift", "Ownership ambiguity", "Escalation probability", "Dependency instability"],
    status: "Actively Monitoring",
    confidence: 86,
    metrics: [{ label: "Alert Load", value: "Moderate" }, { label: "Critical Paths", value: "4" }, { label: "Escalation", value: "+12%" }],
    activity: ["Analyzing escalation pressure", "Scanning dependency volatility", "Forecasting timeline fracture"],
    tone: {
      border: "border-amber-300/20 hover:border-amber-300/45",
      glow: "bg-amber-400/20",
      pill: "border-amber-300/40 bg-amber-300/10 text-amber-900",
      text: "text-amber-800",
      confidenceFrom: "from-amber-300/85",
      confidenceTo: "to-red-300/85",
    },
  },
  {
    name: "Stakeholder Politics Agent",
    purpose: "Maps influence dynamics and communication tension to predict sponsor confidence changes before they surface.",
    signals: ["Political friction", "Sponsor confidence", "Hidden resistance", "Alignment instability"],
    status: "Pattern Analysis",
    confidence: 79,
    metrics: [{ label: "Friction Nodes", value: "7" }, { label: "Sponsor Mood", value: "Guarded" }, { label: "Volatility", value: "Rising" }],
    activity: ["Monitoring sponsor confidence", "Modeling influence clusters", "Detecting alignment slippage"],
    tone: {
      border: "border-violet-300/20 hover:border-violet-300/45",
      glow: "bg-violet-400/20",
      pill: "border-violet-300/40 bg-violet-300/10 text-violet-900",
      text: "text-violet-800",
      confidenceFrom: "from-violet-300/85",
      confidenceTo: "to-indigo-300/85",
    },
  },
  {
    name: "Meetings Agent",
    purpose: "Converts meeting flow into operational memory, extracting commitments, weak signals, and hidden follow-up debt.",
    signals: ["Unresolved decisions", "Accountability gaps", "Repeated concerns", "Meeting sentiment"],
    status: "Live Capture",
    confidence: 88,
    metrics: [{ label: "Captured", value: "31" }, { label: "Action Gaps", value: "6" }, { label: "Sentiment", value: "Neutral" }],
    activity: ["Extracting hidden commitments", "Linking unresolved decisions", "Tracking accountability drift"],
    tone: {
      border: "border-cyan-300/20 hover:border-cyan-300/45",
      glow: "bg-cyan-400/20",
      pill: "border-cyan-300/40 bg-cyan-300/10 text-cyan-900",
      text: "text-cyan-800",
      confidenceFrom: "from-cyan-300/85",
      confidenceTo: "to-blue-300/85",
    },
  },
  {
    name: "Lessons Learned Agent",
    purpose: "Builds institutional memory across initiatives and catches recurring execution failures before repetition hardens.",
    signals: ["Repeated delivery mistakes", "Dependency failures", "Governance drift", "Escalation themes"],
    status: "Memory Synthesis",
    confidence: 83,
    metrics: [{ label: "Patterns", value: "19" }, { label: "Recurrence", value: "High" }, { label: "Guardrails", value: "Updated" }],
    activity: ["Learning execution patterns", "Indexing failure recurrence", "Reinforcing governance memory"],
    tone: {
      border: "border-emerald-300/20 hover:border-emerald-300/45",
      glow: "bg-emerald-400/20",
      pill: "border-emerald-300/40 bg-emerald-300/10 text-emerald-900",
      text: "text-emerald-800",
      confidenceFrom: "from-emerald-300/85",
      confidenceTo: "to-teal-300/85",
    },
  },
  {
    name: "Executive Briefing Agent",
    purpose: "Transforms noisy operational movement into concise strategic clarity for executive decision velocity.",
    signals: ["Portfolio confidence", "Strategic blockers", "Organizational risk", "Delivery forecast"],
    status: "Board Mode",
    confidence: 91,
    metrics: [{ label: "Confidence", value: "Strong" }, { label: "Blockers", value: "3" }, { label: "Forecast", value: "On Track" }],
    activity: ["Synthesizing portfolio signal", "Compressing operational noise", "Preparing decision narrative"],
    tone: {
      border: "border-slate-300/20 hover:border-slate-200/45",
      glow: "bg-slate-200/20",
      pill: "border-slate-200/40 bg-slate-100/10 text-slate-900",
      text: "text-slate-900",
      confidenceFrom: "from-slate-100/85",
      confidenceTo: "to-zinc-300/85",
    },
  },
  {
    name: "Follow-up Agent",
    purpose: "Generates interventions, closes ownership gaps, and drives unresolved commitments back into motion.",
    signals: ["Overdue commitments", "Inactive owners", "Follow-up pressure", "Unresolved threads"],
    status: "Intervention Engine",
    confidence: 84,
    metrics: [{ label: "Nudges", value: "24" }, { label: "Dormant", value: "5" }, { label: "Recovery", value: "+18%" }],
    activity: ["Generating intervention queue", "Tracking dormant ownership", "Escalating unresolved threads"],
    tone: {
      border: "border-fuchsia-300/20 hover:border-fuchsia-300/45",
      glow: "bg-fuchsia-400/20",
      pill: "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-900",
      text: "text-fuchsia-800",
      confidenceFrom: "from-fuchsia-300/85",
      confidenceTo: "to-pink-300/85",
    },
  },
] as const;

export default async function ProjectsPage() {
  const user = await requireAuthUser();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("projects")
    .select("id, name, description, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as ProjectRow[];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
      <div className="pointer-events-none absolute -left-24 top-14 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-6%] top-14 h-96 w-96 rounded-full bg-cyan-400/15 blur-[170px]" />

      <div className="relative space-y-12">
        <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-[0_38px_120px_-70px_rgba(52,211,153,0.25)] md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_0,rgba(255,255,255,0.03)_50%,transparent_100%)] bg-[length:100%_120px] opacity-20 motion-safe:animate-[scanline_10s_linear_infinite]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_38%,rgba(244,114,182,0.16),transparent_45%),radial-gradient(circle_at_78%_62%,rgba(34,211,238,0.13),transparent_44%)] motion-safe:animate-[atmosDrift_26s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full bg-fuchsia-300/10 blur-3xl motion-safe:animate-[fogShift_20s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute right-8 top-2 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl motion-safe:animate-[fogShift_24s_ease-in-out_infinite]" />
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full opacity-35">
            <path d="M0 34 C24 38, 46 28, 100 30" className="orchestrate-line"/>
            <path d="M0 58 C28 62, 55 48, 100 54" className="orchestrate-line" style={{ animationDelay: "0.8s" }}/>
            <path d="M0 76 C26 72, 50 66, 100 68" className="orchestrate-line" style={{ animationDelay: "1.4s" }}/>
          </svg>
          <div className="relative max-w-4xl">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-800">PMFreak Intelligence Layer</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">Operational Command Center</h1>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-zinc-700 md:text-base">PMFreak continuously monitors execution risk, stakeholder dynamics, operational drift, political tension, communication patterns, and delivery confidence across your active initiatives.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {[
                "AI Agents Active",
                "Monitoring Execution Signals",
                "Operational Intelligence Online",
              ].map((label) => (
                <span key={label} style={{ animationDelay: `${(label.length % 3) * 0.6}s` }} className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-900 motion-safe:animate-[statusPulse_7.5s_ease-in-out_infinite]">{label}</span>
              ))}
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-xs uppercase tracking-[0.24em] text-zinc-600">Live Operational Stream</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Execution Sensing Feed</h2></div>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-900 motion-safe:animate-[glow_7s_ease-in-out_infinite]">Streaming</span>
          </div>
          <ul className="space-y-2.5">
            {[
              { agent: "Risk Agent", event: "Dependency fracture probability increased after integration sequencing slipped for a second consecutive checkpoint.", time: "just now", sev: "Elevated", tone: "text-amber-800 border-amber-300/25" },
              { agent: "Meetings Agent", event: "Execution debt is accumulating from unresolved architecture follow-up threads with fragmented ownership signals.", time: "2m ago", sev: "Moderate", tone: "text-cyan-800 border-cyan-300/25" },
              { agent: "Stakeholder Politics Agent", event: "Alignment instability detected after steering review surfaced conflicting authority assumptions across sponsors.", time: "4m ago", sev: "Watch", tone: "text-violet-800 border-violet-300/25" },
              { agent: "Follow-up Agent", event: "Escalation pressure is rising as dormant commitments cross intervention thresholds in two critical workstreams.", time: "7m ago", sev: "Action", tone: "text-fuchsia-800 border-fuchsia-300/25" },
              { agent: "Executive Briefing Agent", event: "Confidence erosion detected across integration workstreams after unresolved dependency escalation and decision latency.", time: "10m ago", sev: "Strategic", tone: "text-slate-800 border-slate-300/25" },
            ].map((row, i) => (
              <li key={row.event} style={{ animationDelay: `${i * 0.25}s` }} className="group rounded-2xl border border-slate-200 bg-white p-3.5 motion-safe:animate-[feedFade_9s_ease-in-out_infinite]">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em]"><span className="text-zinc-500">{row.time}</span><span className={`rounded-full border px-2 py-0.5 ${row.tone}`}>{row.sev}</span><span className="text-zinc-600">{row.agent}</span></div>
                <p className="mt-1.5 text-sm text-zinc-800">{row.event}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-600">Agent Network</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900 md:text-3xl">Specialized Operational Agents</h2>
            </div>
            <Link href="/command-center" className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800 transition hover:text-cyan-900">View global command center →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.name} {...agent} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-600">Operational Signals</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Live Execution Pulse</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[{ label: "Portfolio Confidence", value: "82%", tone: "text-emerald-800" }, { label: "Escalation Pressure", value: "Medium", tone: "text-amber-800" }, { label: "Delivery Drift", value: "Contained", tone: "text-cyan-800" }].map((signal) => (
                <div key={signal.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{signal.label}</p>
                  <p className={`mt-1 text-lg font-semibold ${signal.tone}`}>{signal.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-600">Executive Intelligence Feed</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Decision-Ready Summaries</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-700">
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">Sponsor confidence is stable in 4 contexts; watch cross-team dependency in ERP Phase 2.</li>
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">Follow-up debt increased by 12% this week due to unresolved meeting actions.</li>
              <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">Political friction risk elevated around integration ownership and sequencing clarity.</li>
            </ul>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-600">Operational Contexts</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Execution Environments Feeding Agent Intelligence</h2>
            </div>
          </div>

          <form action={createProjectAction} className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.2fr_1.8fr_auto] md:items-end">
            <label className="space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
              Context Name
              <input name="name" required placeholder="ERP Phase 2 rollout" className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70" />
            </label>
            <label className="space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
              Operational Scope
              <input name="description" placeholder="Sponsor expectations, major dependencies, timeline pressure" className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70" />
            </label>
            <button type="submit" className="rounded-xl border border-cyan-200/45 bg-cyan-400/[0.1] px-4 py-2.5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.16]">Add Context</button>
          </form>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-zinc-700 md:col-span-2">No operational contexts connected yet. PMFreak agents are standing by. Connect an active initiative to activate sensing, memory, risk analysis, political intelligence, and execution guidance.</div>
            ) : (
              projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200/35 hover:bg-slate-50">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Context</p>
                  <h3 className="mt-1 text-lg font-semibold text-cyan-900 group-hover:text-cyan-950">{project.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-700">{project.description ?? "Operational details pending."}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-zinc-500">{project.status} · Connected {new Date(project.created_at).toLocaleDateString()}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
