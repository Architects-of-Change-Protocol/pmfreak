import Link from "next/link";

export function WorkspaceContextBanner({
  lens,
  returnHref = "/workspace",
}: {
  lens: string;
  returnHref?: string;
}) {
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
