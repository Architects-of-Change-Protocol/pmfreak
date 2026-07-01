import Link from "next/link";

export function WorkspaceContextBanner({
  lens,
  returnHref = "/workspace",
  variant = "dark",
}: {
  lens: string;
  returnHref?: string;
  /** "light" renders on white/premium surfaces (e.g. Command Center); "dark" is the default operational-shell styling. */
  variant?: "dark" | "light";
}) {
  if (variant === "light") {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-500">Workspace / {lens}</p>
          <Link href={returnHref} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
            Workspace
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-200">Workspace / {lens}</p>
        <Link href={returnHref} className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/20">
          Workspace
        </Link>
      </div>
    </section>
  );
}
