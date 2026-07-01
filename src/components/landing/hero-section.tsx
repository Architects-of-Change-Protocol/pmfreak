import Link from "next/link";

const capabilityPills = [
  "Decisions",
  "Risks",
  "Commitments",
  "Approvals",
  "Clear Record",
  "Secure Workspace",
];

const tools = [
  { name: "ChatGPT", dot: "bg-emerald-400" },
  { name: "Claude", dot: "bg-amber-300" },
  { name: "Slack", dot: "bg-fuchsia-400" },
  { name: "Notion", dot: "bg-slate-300" },
  { name: "Email", dot: "bg-cyan-300" },
  { name: "Docs", dot: "bg-pink-300" },
];

const leakageLabels = [
  "stakeholder escalations",
  "delivery risks",
  "commitments",
  "internal decisions",
  "meeting notes",
  "lessons learned",
  "approvals",
  "timeline drift",
  "recurring incidents",
];

const metrics = [
  ["Decisions Tracked", 85],
  ["Context Organized", 72],
  ["Risks Detected", 68],
] as const;

const memoryNodes = [
  { x: 18, y: 38, size: "lg", color: "cyan", rhythm: "5.2s" },
  { x: 30, y: 56, size: "sm", color: "pink", rhythm: "6.1s" },
  { x: 42, y: 32, size: "md", color: "cyan", rhythm: "4.8s" },
  { x: 52, y: 46, size: "sm", color: "pink", rhythm: "5.8s" },
  { x: 62, y: 26, size: "md", color: "cyan", rhythm: "5.1s" },
  { x: 74, y: 40, size: "lg", color: "pink", rhythm: "6.4s" },
  { x: 80, y: 62, size: "sm", color: "cyan", rhythm: "5.7s" },
  { x: 56, y: 66, size: "md", color: "cyan", rhythm: "6.6s" },
  { x: 36, y: 70, size: "sm", color: "pink", rhythm: "6.9s" },
];

const neuralConnections = [
  "M18 38 C26 42, 34 50, 42 32",
  "M42 32 C49 32, 54 38, 62 26",
  "M62 26 C70 30, 74 34, 74 40",
  "M30 56 C40 58, 48 54, 56 66",
  "M56 66 C66 67, 73 64, 80 62",
  "M42 32 C46 42, 50 46, 52 46",
  "M52 46 C60 42, 66 40, 74 40",
  "M36 70 C44 70, 50 68, 56 66",
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="translate-x-28 md:translate-x-40 pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-[#ff0b8a]/16 blur-[130px]" />
      <div className="pointer-events-none absolute right-[-4%] top-20 h-96 w-96 rounded-full bg-cyan-400/14 blur-[160px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(148,233,255,0.08),transparent_42%),radial-gradient(circle_at_35%_78%,rgba(255,95,198,0.08),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 hidden opacity-45 md:block">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={`depth-${i}`}
            style={{ top: `${6 + (i % 6) * 16}%`, left: `${8 + (i % 9) * 10}%`, animationDelay: `${i * 0.55}s` }}
            className="absolute h-0.5 w-0.5 rounded-full bg-cyan-100/80 motion-safe:animate-[depthParticle_16s_ease-in-out_infinite]"
          />
        ))}
      </div>

      <div className="relative grid gap-8 xl:grid-cols-[1fr_1.22fr] xl:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff5fae]">
            Project knowledge, protected.
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-6xl">
            Stop leaking project intelligence.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-300 md:text-lg">
            Your projects already know more than your tools can show.
          </p>
          <p className="mt-4 text-base leading-relaxed text-zinc-300 md:text-lg">
            Every decision, risk, blocker, commitment, approval, and lesson learned
            is part of your company&rsquo;s knowledge. But too much of it gets lost
            across emails, meetings, spreadsheets, chats, and uncontrolled AI tools.
          </p>
          <p className="mt-4 text-base leading-relaxed text-zinc-300 md:text-lg">
            PMFreak helps teams keep project knowledge organized, protected, and
            actionable &mdash; so everyone can understand what happened, what
            matters now, and what should happen next.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-full bg-[#ff0b8a] px-6 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(255,11,138,0.55)] transition hover:bg-[#e10079]">Request Founder Access</Link>
            <Link href="/command-center" className="rounded-full border border-white/25 bg-black/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">Open Command Center</Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {capabilityPills.map((pill) => (
              <span key={pill} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur">{pill}</span>
            ))}
          </div>
        </div>

        <div className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-black/35 p-4 sm:p-6 lg:p-7">
          <div className="relative flex min-h-[360px] flex-col gap-4 overflow-hidden md:min-h-[400px] md:flex-row md:gap-5">
            <div className="w-full translate-y-2 space-y-2 md:w-[27%]">
              {tools.map((tool, i) => (
                <div key={tool.name} style={{ animationDelay: `${i * 0.42}s` }} className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-zinc-100 backdrop-blur motion-safe:animate-[float_11s_ease-in-out_infinite]">
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${tool.dot}`} />
                  {tool.name}
                </div>
              ))}
            </div>

            <div className="relative hidden md:block md:w-[32%]">
              <div className="absolute inset-0 rounded-[80px] bg-gradient-to-r from-cyan-400/10 via-fuchsia-300/10 to-cyan-300/10 blur-sm" />
              <div className="absolute inset-0 rounded-[80px] bg-[radial-gradient(circle_at_25%_32%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_76%_62%,rgba(244,114,182,0.12),transparent_48%)]" />
              {leakageLabels.map((label, i) => (
                <span key={label} style={{ top: `${8 + i * 9}%`, animationDelay: `${i * 0.45}s` }} className="absolute left-8 rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[10px] text-zinc-300 motion-safe:animate-[drift_12s_linear_infinite]">{label}</span>
              ))}

              <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-70">
                <path d="M4 18 C26 20, 45 28, 95 36" className="stream-line" style={{ animationDelay: "0.1s" }} />
                <path d="M6 34 C30 36, 54 40, 95 48" className="stream-line" style={{ animationDelay: "0.5s" }} />
                <path d="M4 52 C26 56, 50 58, 95 63" className="stream-line" style={{ animationDelay: "0.9s" }} />
                <path d="M7 68 C33 69, 56 68, 95 76" className="stream-line" style={{ animationDelay: "1.3s" }} />
              </svg>

              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={`funnel-p-${i}`}
                  style={{ top: `${12 + (i % 7) * 11}%`, left: `${8 + (i % 5) * 16}%`, animationDelay: `${i * 0.25}s` }}
                  className="absolute h-1 w-1 rounded-full bg-cyan-200/90 motion-safe:animate-[funnelParticle_6.6s_linear_infinite]"
                />
              ))}

              <span className="absolute right-[-35px] top-[24%] rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-200">classify</span>
              <span className="absolute right-[-45px] top-[52%] rounded-full border border-fuchsia-300/30 bg-fuchsia-300/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-fuchsia-200">synthesize</span>
              <span className="absolute right-[-38px] top-[66%] rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-cyan-200">reinforce</span>
            </div>

            <div className="relative w-full rounded-3xl border border-cyan-200/30 bg-gradient-to-r from-cyan-400/10 via-black/60 to-fuchsia-400/10 p-4 md:w-[45%] motion-safe:animate-[breathe_8s_ease-in-out_infinite]">
              <div className="absolute inset-2 rounded-[18px] border border-white/5" />
              <div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-300">
                <span className="font-bold text-white">PMFreak</span>
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-0.5 text-[9px] text-emerald-200">Operational</span>
              </div>

              <div className="relative mt-3 h-36 overflow-hidden rounded-2xl border border-white/10 bg-black/30 sm:h-40">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_32%,rgba(34,211,238,0.14),transparent_45%),radial-gradient(circle_at_72%_62%,rgba(244,114,182,0.12),transparent_48%)]" />
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="signalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
                      <stop offset="50%" stopColor="rgba(244,114,182,0.7)" />
                      <stop offset="100%" stopColor="rgba(34,211,238,0.15)" />
                    </linearGradient>
                  </defs>
                  {neuralConnections.map((connection, i) => (
                    <g key={connection}>
                      <path d={connection} className="neural-path" style={{ animationDelay: `${i * 0.22}s` }} />
                      <path d={connection} className="neural-signal" style={{ animationDelay: `${i * 0.45}s` }} />
                    </g>
                  ))}
                </svg>

                {memoryNodes.map((node, i) => (
                  <span
                    key={`${node.x}-${node.y}`}
                    style={{ top: `${node.y}%`, left: `${node.x}%`, animationDelay: `${i * 0.3}s`, animationDuration: node.rhythm }}
                    className={`absolute rounded-full ${node.size === "lg" ? "h-3.5 w-3.5" : node.size === "md" ? "h-2.5 w-2.5" : "h-2 w-2"} ${node.color === "cyan" ? "bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.82)]" : "bg-fuchsia-300 shadow-[0_0_12px_rgba(244,114,182,.82)]"} motion-safe:animate-[memoryStrengthen_var(--tw-duration,6s)_ease-in-out_infinite]`}
                  />
                ))}

                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={`orbit-${i}`} style={{ top: `${22 + (i % 3) * 23}%`, left: `${18 + (i % 4) * 16}%`, animationDelay: `${i * 0.28}s` }} className="absolute h-1 w-1 rounded-full bg-cyan-200/90 motion-safe:animate-[orbitalDrift_7s_linear_infinite]" />
                ))}
              </div>

              <div className="relative mt-4 space-y-2.5">
                {metrics.map(([label, pct], i) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-zinc-300"><span>{label}</span><span>{pct}%</span></div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div style={{ width: `${pct}%`, animationDelay: `${i * 0.35}s` }} className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 shadow-[0_0_12px_rgba(34,211,238,.6)] motion-safe:animate-[glow_6s_ease-in-out_infinite]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
