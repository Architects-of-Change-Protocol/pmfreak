import Link from "next/link";
import { ProgramList } from "@/components/program-builder/ProgramList";

export default function ProgramsPage() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
      <div className="pointer-events-none absolute -left-24 top-14 h-80 w-80 rounded-full bg-indigo-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-6%] top-14 h-96 w-96 rounded-full bg-cyan-400/12 blur-[170px]" />

      <div className="relative space-y-8">
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/45 p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_38%,rgba(99,102,241,0.14),transparent_45%),radial-gradient(circle_at_78%_62%,rgba(34,211,238,0.10),transparent_44%)]" />
          <div className="relative max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-200">Program Builder</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Executable Programs</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
              Convert structured roadmaps into executable boards. Build, parse, materialize, and track progress across epics, sprints, and cards.
            </p>
          </div>
        </header>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">All Programs</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Your Programs</h2>
          </div>
          <Link
            href="/programs/new"
            className="rounded-xl border border-indigo-300/40 bg-indigo-400/[0.1] px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/[0.18]"
          >
            New Program
          </Link>
        </div>

        <ProgramList />
      </div>
    </section>
  );
}
