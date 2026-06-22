import type { ProgramStatus } from "@/lib/db/database-contract";

const STATUS_STYLES: Record<ProgramStatus, string> = {
  DRAFT:     "border-zinc-400/30 bg-zinc-400/10 text-zinc-300",
  ACTIVE:    "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
  PAUSED:    "border-amber-300/40 bg-amber-400/10 text-amber-200",
  COMPLETED: "border-cyan-300/40 bg-cyan-400/10 text-cyan-200",
  ARCHIVED:  "border-slate-400/30 bg-slate-400/10 text-slate-400",
};

export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
