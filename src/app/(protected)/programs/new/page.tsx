import Link from "next/link";
import { ProgramCreateForm } from "@/components/program-builder/ProgramCreateForm";

export default function NewProgramPage() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
      <div className="pointer-events-none absolute -left-24 top-14 h-80 w-80 rounded-full bg-indigo-500/15 blur-[140px]" />

      <div className="relative mx-auto max-w-xl space-y-6">
        <div>
          <Link href="/programs" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300 transition">
            ← Programs
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">New Program</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Create a new executable program. You will be taken to the Builder to paste and parse your roadmap.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
          <ProgramCreateForm />
        </div>
      </div>
    </section>
  );
}
