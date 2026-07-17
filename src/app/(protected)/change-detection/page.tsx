import { ChangeFeed } from "@/components/pmfreak/change-detection/change-feed";

export default function ChangeDetectionPage() {
  return <main className="space-y-6 pb-8"><header className="rounded-2xl border border-slate-700 bg-white p-6"><p className="text-xs uppercase tracking-[0.25em] text-cyan-700">PMFreak Temporal Intelligence</p><h1 className="mt-2 text-3xl font-semibold text-slate-900">Change Detection Engine</h1><p className="mt-2 text-sm text-slate-700">Deterministic movement detection across deterioration, improvement, escalation, and suppression states.</p></header><ChangeFeed /></main>;
}
