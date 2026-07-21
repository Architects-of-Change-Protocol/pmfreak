import type { ReactNode } from "react";

function tone(level?: string) {
  if (["critical", "immediate", "degrading", "high", "volatile", "accelerating"].includes(level ?? "")) return "border-red-400/60 bg-red-500/10";
  if (["watch", "watching", "medium", "moderate", "elevated", "increasing"].includes(level ?? "")) return "border-amber-300/60 bg-amber-500/10";
  return "border-cyan-300/40 bg-cyan-500/10";
}

function Shell({ title, children, level }: { title: string; children: ReactNode; level?: string }) {
  return <section className={`rounded-2xl border p-4 ${tone(level)}`}><p className="text-xs uppercase tracking-[0.2em] text-slate-300">{title}</p><div className="mt-3">{children}</div></section>;
}

export const RiskCard = Shell;
export const StakeholderPressureCard = Shell;
export const EscalationCard = Shell;
export const OperationalHealthCard = Shell;
export const CoordinationQueueCard = Shell;
export const RecoveryWorkflowCard = Shell;
export const InterventionCard = Shell;
