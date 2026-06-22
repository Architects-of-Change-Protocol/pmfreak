import Link from "next/link";

export function ProgramEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-8 py-12 text-center">
      <div className="h-12 w-12 rounded-full border border-indigo-300/30 bg-indigo-400/10 flex items-center justify-center">
        <span className="text-xl">◈</span>
      </div>
      <div>
        <p className="text-base font-semibold text-slate-100">No programs yet.</p>
        <p className="mt-1 max-w-md text-sm text-zinc-400">
          Create your first executable program from a roadmap, implementation plan, or structured sprint plan.
        </p>
      </div>
      <Link
        href="/programs/new"
        className="rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-5 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-400/20"
      >
        New Program
      </Link>
    </div>
  );
}
