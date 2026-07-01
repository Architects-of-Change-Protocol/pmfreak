import type { Metadata } from "next";
import Link from "next/link";

import { HeroSection } from "@/components/landing/hero-section";
import { MarketingNavbar } from "@/components/marketing-navbar";

type FooterLink =
  | { label: string; href: string }
  | { label: string; disabled: true };

type FooterColumn = {
  heading: string;
  links: readonly FooterLink[];
};

export const metadata: Metadata = {
  description:
    "PMFreak helps companies keep, protect, and use what they learn from every project.",
};

const operationalRealities = [
  {
    title: "Escalations surface too late",
    description:
      "Critical issues often sit across chats, docs, and meetings before reaching decision makers.",
  },
  {
    title: "Status can look green while real work is already at risk",
    description:
      "Teams often discover delivery problems only after momentum has already been lost.",
  },
  {
    title: "Context fragmentation burns PM time",
    description:
      "Project managers spend hours reconstructing what changed, who owns what, and what needs action.",
  },
  {
    title: "Leadership gets decision-ready context too late",
    description:
      "Scattered updates make it difficult to walk into meetings with clear, current context.",
  },
  {
    title: "Sensitive project knowledge leaks into uncontrolled AI tools",
    description:
      "Without a safe place to work, teams paste confidential context into tools no one is tracking.",
  },
] as const;

const operationalFlowSteps = [
  {
    step: "01",
    title: "Connect the project context",
    text: "Bring together the updates, decisions, risks, and signals that matter.",
  },
  {
    step: "02",
    title: "Build project memory",
    text: "PMFreak keeps track of what happened, who committed to what, and what still needs attention.",
  },
  {
    step: "03",
    title: "Spot what needs action",
    text: "Risks, blockers, overdue commitments, and weak signals are surfaced before they become escalations.",
  },
  {
    step: "04",
    title: "Prepare the next step",
    text: "PMFreak helps draft updates, actions, and recommendations based on the project context.",
  },
  {
    step: "05",
    title: "Keep control",
    text: "Sensitive actions are routed for human approval, and important decisions are recorded.",
  },
] as const;

const solutionCapabilities = [
  {
    title: "Remember decisions",
    description: "Keep a record of what was decided, when, and why.",
  },
  {
    title: "Track risks",
    description: "Surface what's threatening delivery before it becomes a surprise.",
  },
  {
    title: "Capture commitments",
    description: "Know who committed to what, and whether it's still on track.",
  },
  {
    title: "Prepare next actions",
    description: "Get ready-to-review drafts for updates and next steps.",
  },
  {
    title: "Route sensitive actions for approval",
    description: "Nothing sensitive happens without a human in the loop.",
  },
  {
    title: "Keep a clear record of what happened",
    description: "Build a project history your team can trust and reuse.",
  },
] as const;

const traditionalToolPoints = [
  "Track tasks and dates",
  "Depend on manual updates",
  "Show status after the fact",
  "Lose context across projects",
] as const;

const genericAiToolPoints = [
  "Summarize what you paste in",
  "Depend on prompts",
  "Scatter sensitive context",
  "Do not understand your project history",
] as const;

const pmfreakPoints = [
  "Keeps project knowledge organized",
  "Spots risks and commitments",
  "Prepares next actions",
  "Routes sensitive actions for approval",
  "Creates a clear record your team can trust",
] as const;



const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "Product", href: "#intelligence" },
      { label: "How it Works", href: "#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Command Center", href: "/command-center" },
    ],
  },
  {
    heading: "Use Cases",
    links: [
      { label: "PMOs", disabled: true },
      { label: "Delivery Teams", disabled: true },
      { label: "Technical PMs", disabled: true },
      { label: "Consulting Teams", disabled: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", disabled: true },
      { label: "Contact", disabled: true },
      { label: "Roadmap", disabled: true },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", disabled: true },
      { label: "Terms of Service", disabled: true },
      { label: "Security", href: "#security" },
    ],
  },
] as const satisfies readonly FooterColumn[];

const primaryCtaClass =
  "rounded-full bg-[#ff008c] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#db0078]";

const secondaryCtaClass =
  "rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/15";

const lightSectionClass = "rounded-3xl border border-zinc-200 bg-white shadow-sm";

function OperationalRealitySection() {
  return (
    <section className={`${lightSectionClass} p-7 md:p-9`}>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff008c]">
        <span id="intelligence" className="block scroll-mt-[140px]"></span>The problem
      </p>

      <h2 className="mt-3 text-3xl font-black text-zinc-950 md:text-4xl">
        The hidden cost of scattered project knowledge
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">
        Projects don&rsquo;t only create tasks. They create decisions, context,
        risks, commitments, lessons, and evidence. When that knowledge is
        scattered across tools and people, teams move slower, leaders see
        problems too late, and every new project starts from scratch.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {operationalRealities.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
          >
            <h3 className="text-base font-black text-zinc-950 md:text-lg">
              {item.title}
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section className={`${lightSectionClass} p-7 md:p-9`}>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff008c]">
        The solution
      </p>

      <h2 className="mt-3 text-3xl font-black text-zinc-950 md:text-4xl">
        Keep what your projects already know.
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">
        PMFreak helps your team build a shared memory of each project &mdash;
        decisions, risks, blockers, approvals, commitments, and next steps
        &mdash; while keeping sensitive context inside controlled boundaries.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {solutionCapabilities.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
          >
            <h3 className="text-base font-black text-zinc-950 md:text-lg">
              {item.title}
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function OperationalFlowSection() {
  return (
    <section id="how-it-works" className={`${lightSectionClass} scroll-mt-[140px] p-7 md:p-9`}>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff008c]">
        HOW IT WORKS
      </p>

      <h2 className="mt-3 text-3xl font-black text-zinc-950 md:text-4xl">
        From scattered updates to a clear next step.
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">
        PMFreak turns everyday project updates into organized knowledge, clear priorities, and next steps you can trust.
      </p>

      <div className="relative mt-7 overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-b from-white via-zinc-50 to-white p-4 shadow-[0_25px_70px_rgba(10,10,10,0.08)] md:p-7">
        <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-fuchsia-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-10 h-36 w-36 rounded-full bg-cyan-200/60 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(236,72,153,0.10),transparent_40%),radial-gradient(circle_at_75%_65%,rgba(34,211,238,0.10),transparent_38%)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-200/70 opacity-70" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-200/60 opacity-60" />

        <div className="relative">
          <svg viewBox="0 0 1200 560" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" fill="none" aria-hidden>
            <path d="M40 170 C260 170 300 105 510 130 C660 148 680 214 780 228 C910 246 980 220 1160 220" className="signal-path-a" />
            <path d="M44 280 C250 280 300 315 500 300 C640 290 700 238 800 255 C940 280 1000 330 1160 326" className="signal-path-b" />
            <path d="M600 334 C620 390 690 430 820 438 C930 445 1040 420 1154 378" className="signal-path-c" />
            <path d="M594 334 C560 386 488 420 344 434 C228 446 128 428 48 396" className="signal-path-d" />
            <path d="M80 232 C220 236 320 228 490 244 C590 252 665 260 740 286 C858 326 1040 368 1140 364" className="signal-path-e" />
            <path d="M78 196 C228 188 298 140 468 164 C582 182 650 226 734 226 C908 228 1032 206 1138 188" className="signal-path-f" />
            <circle cx="190" cy="220" r="5" className="route-dot dot-a" />
            <circle cx="350" cy="206" r="4.5" className="route-dot dot-b" />
            <circle cx="558" cy="254" r="4.5" className="route-dot dot-c" />
            <circle cx="738" cy="230" r="4.5" className="route-dot dot-d" />
            <circle cx="960" cy="234" r="5" className="route-dot dot-e" />
            <circle cx="600" cy="272" r="12" className="fill-zinc-950/90" />
          </svg>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1.45fr_1.1fr]">
            <article className="rounded-2xl border border-fuchsia-200 bg-white/85 p-4 backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-600">01 • Context</p>
              <h3 className="mt-2 text-base font-black text-zinc-950">{operationalFlowSteps[0].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{operationalFlowSteps[0].text}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-600">
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Updates</span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Decisions</span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Risks & signals</span>
              </div>
            </article>

            <article className="relative row-span-2 rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.10)]">
              <div className="pointer-events-none absolute inset-0 rounded-3xl border border-fuchsia-300/30" />
              <div className="pointer-events-none absolute inset-5 rounded-[1.25rem] border border-cyan-300/25" />
              <div className="core-orbit pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/35" />
              <div className="core-orbit core-orbit-slow pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/25" />
              <div className="absolute left-1/2 top-0 h-16 w-px -translate-x-1/2 bg-gradient-to-b from-fuchsia-300/60 to-transparent" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">03 • Action Signals</p>
              <h3 className="mt-2 text-lg font-black text-zinc-950">{operationalFlowSteps[2].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{operationalFlowSteps[2].text}</p>
              <div className="relative mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-fuchsia-200/40 blur-2xl" />
                <div className="core-blink pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-950/80" />
                <p className="relative text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">PMFreak · Surfacing what needs attention</p>
                <div className="relative mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-zinc-700">
                  <span className="rounded-xl border border-zinc-200 bg-white px-3 py-2">Risks</span>
                  <span className="rounded-xl border border-zinc-200 bg-white px-3 py-2">Blockers</span>
                  <span className="rounded-xl border border-zinc-200 bg-white px-3 py-2">Overdue</span>
                  <span className="rounded-xl border border-zinc-200 bg-white px-3 py-2">Escalate</span>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/60 px-3 py-2 text-xs font-medium text-zinc-700">Risk heat shifts</div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-xs font-medium text-zinc-700">Stakeholder tension</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
                <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-fuchsia-500" />
                Always watching for what needs attention
              </div>
            </article>

            <article className="rounded-2xl border border-cyan-200 bg-white/90 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">05 • Keep Control</p>
              <h3 className="mt-2 text-base font-black text-zinc-950">{operationalFlowSteps[4].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{operationalFlowSteps[4].text}</p>
              <div className="mt-4 space-y-2 text-xs font-medium text-zinc-700">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">Sensitive actions await approval</div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">Decisions recorded automatically</div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">Clear audit trail maintained</div>
              </div>
            </article>
          </div>

          <div className="relative mt-4 grid gap-4 lg:grid-cols-[1.1fr_1.45fr_1.1fr]">
            <article className="rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-700">02 • Memory</p>
              <h3 className="mt-2 text-base font-black text-zinc-950">{operationalFlowSteps[1].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{operationalFlowSteps[1].text}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-600">
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Decisions</span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Commitments</span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Owners</span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">Status</span>
              </div>
            </article>
            <div className="hidden items-center justify-center lg:flex">
              <div className="h-[1px] w-full max-w-[420px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent" />
            </div>
            <article className="relative rounded-2xl border border-zinc-200 bg-white p-4 lg:row-span-2">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(130deg,rgba(236,72,153,0.05),rgba(34,211,238,0.06))]" />
              <p className="relative text-xs font-black uppercase tracking-[0.18em] text-fuchsia-600">04 • Next Step</p>
              <h3 className="relative mt-2 text-base font-black text-zinc-950">{operationalFlowSteps[3].title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-zinc-700">{operationalFlowSteps[3].text}</p>
              <div className="relative mt-4 space-y-2 text-xs text-zinc-700">
                <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2">Draft update ready for review</div>
                <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2">Recommended action for a blocked task</div>
                <div className="rounded-xl border border-zinc-200 bg-white/80 px-3 py-2">Suggested owner for an overdue commitment</div>
              </div>
              <svg viewBox="0 0 320 86" className="mt-3 hidden w-full lg:block" fill="none" aria-hidden>
                <path d="M8 65 C58 28 110 70 160 38 C210 8 252 42 310 20" className="memory-mesh" />
                <circle cx="58" cy="44" r="3.5" className="memory-node" />
                <circle cx="112" cy="58" r="3.5" className="memory-node" />
                <circle cx="168" cy="35" r="3.5" className="memory-node" />
                <circle cx="226" cy="24" r="3.5" className="memory-node" />
                <circle cx="288" cy="22" r="3.5" className="memory-node" />
              </svg>
            </article>
          </div>
        </div>
        <style>{`
          .signal-path-a, .signal-path-b, .signal-path-c, .signal-path-d {
            stroke-width: 2.3;
            stroke-dasharray: 8 10;
            animation: flowDash 18s linear infinite;
            fill: none;
          }
          .signal-path-a { stroke: rgba(236, 72, 153, 0.55); }
          .signal-path-b { stroke: rgba(34, 211, 238, 0.55); animation-duration: 16s; }
          .signal-path-c { stroke: rgba(236, 72, 153, 0.4); animation-duration: 20s; }
          .signal-path-d { stroke: rgba(34, 211, 238, 0.4); animation-duration: 22s; }
          .signal-path-e { stroke: rgba(244, 114, 182, 0.34); animation-duration: 26s; }
          .signal-path-f { stroke: rgba(103, 232, 249, 0.35); animation-duration: 24s; }
          .route-dot {
            fill: rgba(24,24,27,0.7);
            filter: drop-shadow(0 0 8px rgba(236,72,153,0.22));
            animation: routeGlow 4.2s ease-in-out infinite;
          }
          .dot-b { animation-delay: .6s; }
          .dot-c { animation-delay: 1.2s; }
          .dot-d { animation-delay: 1.8s; }
          .dot-e { animation-delay: 2.4s; }
          .core-orbit {
            animation: spinOrbit 18s linear infinite;
            transform-origin: center;
          }
          .core-orbit-slow { animation-duration: 28s; animation-direction: reverse; }
          .core-blink { animation: coreBlink 2.6s ease-in-out infinite; }
          .memory-mesh {
            stroke: rgba(82,82,91,0.45);
            stroke-width: 1.4;
            stroke-dasharray: 6 8;
            animation: flowDash 26s linear infinite;
          }
          .memory-node {
            fill: rgba(24,24,27,0.65);
            animation: memoryPulse 3.8s ease-in-out infinite;
          }
          .memory-node:nth-of-type(2) { animation-delay: .5s; }
          .memory-node:nth-of-type(3) { animation-delay: 1s; }
          .memory-node:nth-of-type(4) { animation-delay: 1.5s; }
          .memory-node:nth-of-type(5) { animation-delay: 2s; }
          @keyframes flowDash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -360; }
          }
          @keyframes routeGlow {
            0%, 100% { opacity: .45; transform: scale(1); }
            50% { opacity: .95; transform: scale(1.18); }
          }
          @keyframes spinOrbit {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to { transform: translate(-50%, -50%) rotate(360deg); }
          }
          @keyframes coreBlink {
            0%, 100% { opacity: .55; box-shadow: 0 0 0 rgba(236,72,153,0); }
            50% { opacity: 1; box-shadow: 0 0 16px rgba(236,72,153,.42); }
          }
          @keyframes memoryPulse {
            0%, 100% { opacity: .5; }
            50% { opacity: .95; }
          }
        `}</style>
      </div>
    </section>
  );
}

function GovernanceSection() {
  return (
    <section
      id="security"
      className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-[0_24px_90px_rgba(15,23,42,0.24)] md:p-10"
    >
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
        Governance and control
      </p>

      <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
        Use AI without losing control.
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 md:text-base">
        PMFreak helps teams use AI around project work without scattering
        sensitive context or letting important actions happen without review.
        Your team gets speed, memory, and clarity &mdash; with boundaries.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_1fr] lg:items-center">
        <div>
          <ul className="space-y-3">
            {[
              "Keep project context in controlled spaces",
              "Route sensitive actions for approval",
              "Preserve a clear history of decisions and changes",
              "Reduce copy-paste into uncontrolled AI tools",
              "Help teams reuse what they learn",
            ].map((point) => (
              <li
                key={point}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-zinc-100"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 p-5">
          <svg viewBox="0 0 580 320" className="h-full w-full" role="img" aria-label="Controlled boundary filtering project signals into project memory while leakage is blocked">
            <defs>
              <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.2)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0.75)" />
              </linearGradient>
            </defs>
            <text x="18" y="38" fill="rgba(161,161,170,0.9)" fontSize="13" fontWeight="700">Project signals</text>
            <text x="216" y="40" fill="rgba(244,244,245,0.95)" fontSize="13" fontWeight="700">Controlled boundary</text>
            <text x="430" y="40" fill="rgba(244,244,245,0.95)" fontSize="13" fontWeight="700">Project memory</text>
            <text x="392" y="278" fill="rgba(244,114,182,0.95)" fontSize="12" fontWeight="700">Leakage blocked</text>

            <rect x="210" y="58" width="168" height="180" rx="20" fill="rgba(39,39,42,0.62)" stroke="rgba(34,211,238,0.42)" strokeWidth="1.2" />
            <circle cx="110" cy="108" r="8" fill="rgba(34,211,238,0.92)" />
            <circle cx="110" cy="158" r="8" fill="rgba(34,211,238,0.74)" />
            <circle cx="110" cy="208" r="8" fill="rgba(34,211,238,0.54)" />
            <path d="M118 108 C158 108, 176 94, 210 102" stroke="url(#flowLine)" strokeWidth="2.6" fill="none" />
            <path d="M118 158 C158 158, 176 156, 210 154" stroke="url(#flowLine)" strokeWidth="2.6" fill="none" />
            <path d="M118 208 C158 208, 176 220, 210 210" stroke="url(#flowLine)" strokeWidth="2.6" fill="none" />

            <rect x="406" y="90" width="144" height="118" rx="16" fill="rgba(8,47,73,0.24)" stroke="rgba(34,211,238,0.45)" strokeWidth="1.1" />
            <path d="M378 154 C396 154, 398 150, 406 150" stroke="rgba(34,211,238,0.78)" strokeWidth="2.6" fill="none" />
            <circle cx="438" cy="126" r="6" fill="rgba(34,211,238,0.8)" />
            <circle cx="472" cy="150" r="6" fill="rgba(34,211,238,0.9)" />
            <circle cx="506" cy="172" r="6" fill="rgba(34,211,238,0.68)" />
            <path d="M438 126 L472 150 L506 172" stroke="rgba(34,211,238,0.55)" strokeWidth="1.8" fill="none" />

            <path d="M286 238 C294 264, 336 276, 372 266" stroke="rgba(244,114,182,0.5)" strokeDasharray="6 6" strokeWidth="2" fill="none" />
            <path d="M372 266 l-8 -2 l2 -8" stroke="rgba(244,114,182,0.74)" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className={`${lightSectionClass} p-7 md:p-10`}>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff008c]">
        How PMFreak is different
      </p>
      <h2 className="mt-3 text-3xl font-black text-zinc-950 md:text-4xl">
        Not another AI project management tool.
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">
        Traditional tools track work. Generic AI tools generate suggestions.
        PMFreak helps your team protect project knowledge, understand what
        changed, and take the right next step without losing control.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3 md:items-stretch">
        <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
            Traditional PM tools
          </h3>
          <ul className="mt-4 space-y-3 text-sm font-medium text-zinc-600">
            {traditionalToolPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
            Generic AI tools
          </h3>
          <ul className="mt-4 space-y-3 text-sm font-medium text-zinc-600">
            {genericAiToolPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
          <h3 className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            PMFreak
          </h3>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-white">
            {pmfreakPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function PoweredByAocSection() {
  return (
    <section className={`${lightSectionClass} p-7 md:p-9`}>
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#ff008c]">
        Built on AOC
      </p>

      <h2 className="mt-3 text-2xl font-black text-zinc-950 md:text-3xl">
        Built on AOC
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">
        PMFreak is the first product built on AOC Protocol and AOC Enterprise
        &mdash; the governance foundation behind how project knowledge,
        AI-assisted actions, approvals, and audit-ready records are managed.
      </p>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-zinc-950 p-7 shadow-[0_20px_80px_rgba(15,23,42,0.18)] md:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
        Get started
      </p>

      <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
        Stop losing what your projects already know.
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 md:text-base">
        PMFreak helps your team turn scattered project work into organized
        knowledge, safer AI-assisted action, and a project history people can
        actually use.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/signup" className={primaryCtaClass}>
          Request Founder Access
        </Link>

        <Link href="/command-center" className={secondaryCtaClass}>
          Open Command Center
        </Link>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="rounded-3xl border border-zinc-800 bg-zinc-950 px-7 py-8 text-zinc-300 md:px-9">
      <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
        {footerColumns.map((column) => (
          <div key={column.heading}>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
              {column.heading}
            </h3>

            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  {"disabled" in link ? (
                    <span className="cursor-default text-zinc-500">
                      {link.label}
                    </span>
                  ) : (
                    <Link
                      href={link.href}
                      className="transition hover:text-cyan-200"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-white/10 pt-6">
        <p className="text-sm font-semibold text-white">PMFreak</p>

        <p className="mt-1 text-xs text-zinc-400">
          PMFreak helps teams keep, protect, and use what they learn from every project.
        </p>

        <p className="mt-3 text-xs text-zinc-500">
          © {new Date().getFullYear()} PMFreak. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <>
      <MarketingNavbar />

      <main className="min-h-screen bg-white px-5 py-8 text-zinc-950 md:px-8 md:py-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-9 md:gap-12">
          <HeroSection />

          <OperationalRealitySection />

          <SolutionSection />

          <OperationalFlowSection />

          <ComparisonSection />

          <GovernanceSection />

          <PoweredByAocSection />

          <FinalCtaSection />

          <LandingFooter />
        </div>
      </main>
    </>
  );
}
