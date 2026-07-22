export function ProjectBrainOnlineHero({ projectName }: { projectName: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[160px]" />
      <div className="pointer-events-none absolute right-[-8%] top-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/10 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.06] blur-[120px]" />

      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-400/70">
          PMFreak · {projectName || "Project"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Project Brain Online</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Your project is now operational. Every email, meeting, document, screenshot, decision, and conversation
          you add becomes part of your project&apos;s operational memory.
        </p>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">
          The more evidence you provide, the smarter your Project Brain becomes.
        </p>
      </div>
    </section>
  );
}
