import { CreateProjectWizard } from "@/components/pmfreak/projects/create-project-wizard";

type Props = { searchParams: Promise<{ pmoId?: string }> };

export default async function CreateProjectPage({ searchParams }: Props) {
  const { pmoId } = await searchParams;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-indigo-500/10 blur-[160px]" />
      <div className="pointer-events-none absolute right-[-8%] top-20 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[180px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.06] blur-[120px]" />

      <div className="relative">
        <header className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-400/60">PMFreak · Project Intelligence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Initialize Project Intelligence
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Build the governance context that powers your AI project agents. Every risk signal, stakeholder insight, and delivery escalation traces back to this foundation.
          </p>
        </header>

        <CreateProjectWizard pmoId={pmoId} />
      </div>
    </section>
  );
}
