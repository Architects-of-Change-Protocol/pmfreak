import type { InitializationStageConfig } from "./activation-sequence-config";

type Phase = "pending" | "active" | "complete";

/** One reusable row for a single initialization stage — pending / active / complete. */
export function InitializationStage({ stage, phase }: { stage: InitializationStageConfig; phase: Phase }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl px-4 py-3 transition-all duration-500 ${
        phase === "active"
          ? "border border-cyan-200/60 bg-cyan-400/[0.06]"
          : phase === "complete"
            ? "opacity-60"
            : "opacity-30"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors duration-500 ${
          phase === "complete"
            ? "border-emerald-300 bg-emerald-50 text-emerald-600"
            : phase === "active"
              ? "border-cyan-300 bg-cyan-100 text-cyan-700"
              : "border-slate-300 text-slate-400"
        }`}
      >
        {phase === "complete" ? "✓" : phase === "active" ? "●" : "○"}
      </span>
      <p
        className={`text-sm font-medium transition-colors duration-300 ${
          phase === "active" ? "text-slate-900" : phase === "complete" ? "text-slate-600" : "text-slate-400"
        }`}
      >
        {phase === "complete" ? stage.completeLabel : stage.label}
        {phase === "active" && <span className="ml-1 animate-pulse">…</span>}
      </p>
    </div>
  );
}
