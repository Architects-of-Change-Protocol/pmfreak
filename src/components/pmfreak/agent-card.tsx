import Link from "next/link";

type AgentCardProps = {
  name: string;
  purpose: string;
  signals: readonly string[];
  status: string;
  confidence: number;
  metrics: readonly { readonly label: string; readonly value: string }[];
  activity: readonly string[];
  tone: {
    border: string;
    glow: string;
    pill: string;
    text: string;
    confidenceFrom: string;
    confidenceTo: string;
  };
  href?: string;
};

export function AgentCard({ name, purpose, signals, status, confidence, metrics, tone, activity, href = "/command-center" }: AgentCardProps) {
  return (
    <article className={`group relative overflow-hidden rounded-3xl border bg-slate-50 p-5 shadow-[0_30px_70px_-45px_rgba(0,0,0,0.9)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 ${tone.border}`}>
      <div className={`pointer-events-none absolute -right-14 -top-12 h-44 w-44 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-90 ${tone.glow}`} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-600">Operational Agent</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-900">{name}</h3>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${tone.pill} motion-safe:animate-[glow_6s_ease-in-out_infinite]`}>{status}</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-700">{purpose}</p>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Live process</div>
          <div className="relative mt-1 h-4">
            {activity.map((step, idx) => (
              <p key={step} style={{ animationDelay: `${idx * 2.8}s` }} className="absolute inset-0 text-xs text-zinc-800 opacity-0 motion-safe:animate-[feedFade_11s_ease-in-out_infinite]">{step}</p>
            ))}
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-50"><div className="h-full w-1/3 rounded-full bg-slate-50 motion-safe:animate-[streamSweep_7s_linear_infinite]" /></div>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-2">
          {signals.map((signal) => <li key={signal} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-zinc-800">{signal}</li>)}
        </ul>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-2"><p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{metric.label}</p><p className="mt-1 text-sm font-semibold text-zinc-900">{metric.value}</p></div>)}
        </div>

        <div className="mt-5"><div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-600"><span>Operational Confidence</span><span className={tone.text}>{confidence}%</span></div><div className="h-1.5 rounded-full bg-slate-50"><div className={`h-full rounded-full bg-gradient-to-r shadow-[0_0_12px_rgba(255,255,255,0.3)] motion-safe:animate-[breathe_8s_ease-in-out_infinite] ${tone.confidenceFrom} ${tone.confidenceTo}`} style={{ width: `${confidence}%` }} /></div></div>
        <Link href={href} className={`mt-5 inline-flex text-xs font-semibold uppercase tracking-[0.18em] transition ${tone.text}`}>Open intelligence stream →</Link>
      </div>
    </article>
  );
}
