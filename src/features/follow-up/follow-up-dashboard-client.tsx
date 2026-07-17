"use client";

import { useState } from "react";
import useSWR from "swr";

type AnyRecord = Record<string, unknown>;

type DashboardMode = "pm" | "pmo" | "executive" | "client";

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed ${url}`);
  return response.json();
};

const modes: { key: DashboardMode; label: string }[] = [
  { key: "pm", label: "PM view" },
  { key: "pmo", label: "PMO Director view" },
  { key: "executive", label: "Executive Sponsor view" },
  { key: "client", label: "Client-facing view" },
];

function DashboardCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-lg"><h2 className="text-lg font-semibold text-slate-900">{title}</h2><div className="mt-3 space-y-2 text-sm text-slate-800">{children}</div></section>;
}

const insight = (label: string, value: unknown, source: string, why: string, confidence = 0.72, updated?: string) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={label}>
    <p className="text-slate-600">{label}</p>
    <p className="font-semibold text-slate-900">{String(value ?? "unknown")}</p>
    <p className="mt-1 text-xs text-slate-600">Source: {source} · Confidence: {(confidence * 100).toFixed(0)}% · Last updated: {updated ? new Date(updated).toLocaleString() : "n/a"}</p>
    <p className="text-xs text-cyan-800">Why PMFreak says this: {why}</p>
  </div>
);

export function FollowUpDashboardClient({ projectId }: { projectId?: string }) {
  const [selectedMode, setSelectedMode] = useState<DashboardMode>("pm");
  const scoped = projectId ? `?projectId=${projectId}` : "";
  const risk = useSWR(`/api/intelligence/execution-risk${scoped}`, fetcher, { refreshInterval: 25000 });
  const stakeholders = useSWR(`/api/intelligence/stakeholders${scoped}`, fetcher, { refreshInterval: 25000 });
  const interventions = useSWR(`/api/intelligence/interventions${scoped}`, fetcher, { refreshInterval: 25000 });
  const coordination = useSWR(`/api/intelligence/coordination${scoped}`, fetcher, { refreshInterval: 25000 });
  const liveOps = useSWR(`/api/intelligence/operational-live${scoped}`, fetcher, { refreshInterval: 25000 });
  const memory = useSWR(`/api/operational-memory${scoped}`, fetcher, { refreshInterval: 40000 });

  const loading = [risk, stakeholders, interventions, coordination, liveOps, memory].some((r) => r.isLoading);
  const errored = [risk, stakeholders, interventions, coordination, liveOps, memory].find((r) => r.error);

  const records = (memory.data?.records ?? []) as AnyRecord[];
  const domainCoverage = ["stakeholder-intelligence", "delivery-intelligence", "risk-intelligence", "pmo-governance", "team-health", "executive-context", "operational-memory", "general-chat-context"];
  const present = new Set(records.map((r) => String(r.domain ?? "").toLowerCase()));
  const completion = Math.round((domainCoverage.filter((d) => present.has(d)).length / domainCoverage.length) * 100);


  if (errored) return <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-900">Unable to load follow-up dashboard intelligence. Try refresh.</div>;

  return (
    <div className="space-y-5 pb-8">
      <header className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-700">PMFreak Execution Follow-Up Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">{projectId ? "Project Follow-Up" : "Portfolio Follow-Up"}</h1>
        <p className="mt-2 text-sm text-slate-700">Professional, sharp follow-up telemetry for project execution commitments.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {modes.map((m) => <button key={m.key} onClick={() => setSelectedMode(m.key)} className={`rounded-lg border px-3 py-1 text-sm ${selectedMode === m.key ? "border-cyan-300 text-cyan-900" : "border-slate-200 text-slate-700"}`}>{m.label}</button>)}
        </div>
      </header>

      {loading ? <div className="rounded-xl border border-slate-200 p-4 text-slate-700">Loading dashboard intelligence...</div> : null}

      <DashboardCard title="A) Executive Status Summary"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{insight("Overall status", risk.data?.overallRisk, "execution-risk", "Risk synthesis from execution telemetry.", 0.85, risk.data?.generatedAt)}{insight("Delivery confidence", risk.data?.deliveryConfidence, "execution-risk", "Confidence decays with blocker and cadence instability.", 0.84, risk.data?.generatedAt)}{insight("Escalation probability", interventions.data?.intervention?.escalationProbability, "interventions", "Intervention engine predicts chain escalation.", 0.82, interventions.data?.generatedAt)}{insight("Stakeholder pressure", stakeholders.data?.executivePressure, "stakeholders", "Pressure inferred from power+alignment signals.", 0.79, stakeholders.data?.generatedAt)}{insight("Intervention urgency", interventions.data?.intervention?.interventionUrgency, "interventions", "Urgency raised by drift and deadlock markers.", 0.81, interventions.data?.generatedAt)}{insight("PMFreak commentary", "This project is not red yet, but it is starting to smell like smoke.", "operational-live", "Signals show pressure rising faster than stability.", 0.77, liveOps.data?.generatedAt)}</div></DashboardCard>

      <DashboardCard title="B) What Changed Since Last Update"><ul className="list-disc space-y-1 pl-5"><li>New risks: {(risk.data?.activeEscalationRisk ?? "none") as string}</li><li>Stakeholder alignment changed: {(stakeholders.data?.profiles ?? []).filter((p: AnyRecord) => p.alignmentStatus !== "aligned").length} unstable relationships.</li><li>New blockers: {String(interventions.data?.intervention?.operationalDriftSignal?.blockerAccumulation ?? "n/a")}</li><li>Resolved blockers: derive from operational-memory status updates (pending richer schema).</li><li>Delivery confidence changes: {String(risk.data?.deliveryConfidence ?? "n/a")}.</li><li>New decisions: {(coordination.data?.coordination?.machineOutput?.decisionQueue ?? []).length ?? 0}</li><li>Governance deviations: {String(coordination.data?.coordination_conflict_risk?.level ?? "unknown")}</li></ul></DashboardCard>

      <DashboardCard title="C) Current Risk Register">{((interventions.data?.intervention?.riskRegister ?? []) as AnyRecord[]).slice(0, 6).map((r, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-2">Risk: {String(r.risk ?? r.title ?? "Execution risk")} · Severity: {String(r.severity ?? "medium")} · Probability: {String(r.probability ?? "medium")} · Owner: {String(r.owner ?? "PM")} · Mitigation: {String(r.mitigation ?? "Define action plan")} · Escalation needed: {String(r.escalationNeeded ?? "review")} · Status: {String(r.status ?? "open")}</div>)}</DashboardCard>

      <DashboardCard title="D) Stakeholder Tracking">{((stakeholders.data?.profiles ?? []) as AnyRecord[]).slice(0, 8).map((p, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-2">{String(p.name ?? `Stakeholder ${idx + 1}`)} · Role: {String(p.role ?? "n/a")} · Decision power: {String(p.decisionPower ?? p.powerLevel ?? "n/a")} · Influence: {String(p.influenceLevel ?? "n/a")} · Support: {String(p.alignmentStatus ?? "neutral")} · Style: {String(p.preferredCommunicationStyle ?? "direct")} · Pressure: {String(p.pressureLevel ?? "watch")}</div>)}</DashboardCard>

      <DashboardCard title="E/F) Action Items + Decisions Pending"><p>You need a decision before another status meeting happens.</p>{((coordination.data?.coordination?.operational_priority_queue?.actions ?? []) as AnyRecord[]).slice(0, 6).map((a, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-2">Action: {String(a.type ?? "Follow-up")} · Owner: {String(a.targetStakeholder ?? "PM")} · Due: {String((a.executionWindow as AnyRecord)?.label ?? "next cadence")} · Dependency: {((a.dependencyChain as AnyRecord[] | undefined) ?? []).map((d) => String(d.reason)).join("; ") || "none"} · Status: pending · Escalation needed: {String(a.urgency ?? "review")}</div>)}</DashboardCard>

      <DashboardCard title="G/H/I) Governance, Team Health, Recommended Intervention"><p>Methodology alignment: {String(coordination.data?.coordination_conflict_risk?.level ?? "watch")}. Reporting cadence: {String(interventions.data?.intervention?.operationalDriftSignal?.unstableCadence ?? "stable")}. Governance drift: {String(coordination.data?.timelineIntelligence ?? "low")}.</p><p>PM overload: {String(interventions.data?.intervention?.operationalDriftSignal?.pmOverloadSignal ?? "n/a")}. Meeting pressure: {String(stakeholders.data?.executivePressure ?? "n/a")}. Fatigue risk: {String(interventions.data?.intervention?.operationalDriftSignal?.executionSilence ?? "n/a")}.</p><p>Recommended now: {String(interventions.data?.intervention?.recommendedAction ?? "Run targeted intervention with decision owner.")} Why: stakeholder pressure is rising faster than delivery confidence. Escalation target: {String(interventions.data?.intervention?.escalationTarget ?? "PMO Director")}. Expected impact: reduce escalation probability by tightening dependency ownership.</p></DashboardCard>

      <DashboardCard title="Export-Ready Outputs"><div className="flex flex-wrap gap-2 text-xs">{["Copy executive update", "Generate status report", "Generate meeting agenda", "Generate escalation note", "Generate weekly PMO report"].map((item) => <button key={item} className="rounded-lg border border-cyan-400/40 px-2 py-1 text-cyan-900">{item}</button>)}</div></DashboardCard>

      <DashboardCard title="Missing Data Awareness"><p>Completion score: <span className="font-semibold text-slate-900">{completion}%</span></p><p>Ask next: who owns unresolved blockers, which decision is blocked by governance gate, which stakeholder shifted support this week?</p><p>Jump to domain chats: stakeholder intelligence, delivery intelligence, risk intelligence, PMO governance, team health.</p></DashboardCard>
    </div>
  );
}
