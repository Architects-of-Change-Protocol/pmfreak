"use client";

import { useState } from "react";
import useSWR from "swr";
import { EmptyExecution } from "@/components/pmfreak/empty-states";

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

const insight = (label: string, value: unknown, source: string, why: string, updated?: string) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={label}>
    <p className="text-slate-600">{label}</p>
    <p className="font-semibold text-slate-900">{String(value ?? "—")}</p>
    <p className="mt-1 text-xs text-slate-600">Source: {source} · Last updated: {updated ? new Date(updated).toLocaleString() : "n/a"}</p>
    <p className="text-xs text-cyan-800">Why PMFreak says this: {why}</p>
  </div>
);

const emptyLine = (text: string) => (
  <p className="rounded-lg border border-dashed border-slate-200 bg-white/60 p-3 text-sm text-slate-500">{text}</p>
);

export function FollowUpDashboardClient({ projectId }: { projectId?: string }) {
  const [selectedMode, setSelectedMode] = useState<DashboardMode>("pm");
  const scoped = projectId ? `?projectId=${projectId}` : "";
  const risk = useSWR(`/api/intelligence/execution-risk${scoped}`, fetcher, { refreshInterval: 25000 });
  // Activation evidence drives the contextual CTA on the empty state: with a
  // real project the next action is adding a task; without one, creating it.
  const activation = useSWR(`/api/workspace-activation`, fetcher, { refreshInterval: 30000 });
  const stakeholders = useSWR(`/api/intelligence/stakeholders${scoped}`, fetcher, { refreshInterval: 25000 });
  const interventions = useSWR(`/api/intelligence/interventions${scoped}`, fetcher, { refreshInterval: 25000 });
  const coordination = useSWR(`/api/intelligence/coordination${scoped}`, fetcher, { refreshInterval: 25000 });
  const memory = useSWR(`/api/operational-memory${scoped}`, fetcher, { refreshInterval: 40000 });

  const loading = [risk, stakeholders, interventions, coordination, memory].some((r) => r.isLoading);
  const errored = [risk, stakeholders, interventions, coordination, memory].find((r) => r.error);

  const records = (memory.data?.records ?? []) as AnyRecord[];
  const domainCoverage = ["stakeholder-intelligence", "delivery-intelligence", "risk-intelligence", "pmo-governance", "team-health", "executive-context", "operational-memory", "general-chat-context"];
  const present = new Set(records.map((r) => String(r.domain ?? "").toLowerCase()));
  const completion = Math.round((domainCoverage.filter((d) => present.has(d)).length / domainCoverage.length) * 100);

  if (errored) return <div className="rounded-xl border border-rose-500/40 bg-rose-50 p-4 text-rose-900">Unable to load follow-up dashboard intelligence. Try refresh.</div>;

  // Empty state: no execution memory exists yet. This is a valid workspace state,
  // never rendered as risk, escalation, or intervention signals.
  const isEmpty = !loading && risk.data?.state === "empty" && records.length === 0;

  const intervention = (interventions.data?.intervention ?? null) as AnyRecord | null;
  const interventionPopulated = intervention !== null && intervention.state !== "empty";
  const riskRegister = ((intervention?.riskRegister ?? []) as AnyRecord[]).slice(0, 6);
  const profiles = ((stakeholders.data?.profiles ?? []) as AnyRecord[]).slice(0, 8);
  const actionQueue = (((coordination.data?.coordination as AnyRecord | undefined)?.operational_priority_queue as AnyRecord | undefined)?.actions ?? []) as AnyRecord[];

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

      {isEmpty ? (
        (() => {
          const steps = (activation.data?.data?.activation?.steps ?? []) as {
            id: string;
            status: string;
            actionAllowed: boolean;
          }[];
          const projectStep = steps.find((s) => s.id === "project_created");
          const taskStep = steps.find((s) => s.id === "task_created");
          return (
            <EmptyExecution
              hasProject={projectStep ? projectStep.status === "completed" : undefined}
              canCreate={taskStep ? taskStep.actionAllowed : true}
            />
          );
        })()
      ) : !loading ? (
        <>
          <DashboardCard title="A) Executive Status Summary"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{insight("Overall status", risk.data?.overallRisk, "execution-risk", "Risk synthesis from execution telemetry.", risk.data?.generatedAt)}{insight("Delivery confidence", risk.data?.deliveryConfidence, "execution-risk", "Confidence decays with blocker and cadence instability.", risk.data?.generatedAt)}{insight("Escalation probability", intervention?.escalationProbability, "interventions", "Intervention engine predicts chain escalation.", interventions.data?.generatedAt)}{insight("Stakeholder pressure", stakeholders.data?.executivePressure, "stakeholders", "Pressure inferred from power+alignment signals.", stakeholders.data?.generatedAt)}{insight("Intervention urgency", intervention?.interventionUrgency, "interventions", "Urgency raised by drift and deadlock markers.", interventions.data?.generatedAt)}</div></DashboardCard>

          <DashboardCard title="B) What Changed Since Last Update"><ul className="list-disc space-y-1 pl-5"><li>Active escalation risk: {String(risk.data?.activeEscalationRisk ?? "none")}</li><li>Stakeholder alignment changed: {profiles.filter((p) => p.alignmentStatus !== "aligned").length} unstable relationships.</li><li>Delivery confidence: {String(risk.data?.deliveryConfidence ?? "—")}.</li><li>Decisions in queue: {(((coordination.data?.coordination as AnyRecord | undefined)?.machineOutput as AnyRecord | undefined)?.decisionQueue as AnyRecord[] | undefined)?.length ?? 0}</li></ul></DashboardCard>

          <DashboardCard title="C) Current Risk Register">{riskRegister.length === 0 ? emptyLine("No risks recorded yet. Risks appear as execution data accumulates.") : riskRegister.map((r, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-2">Risk: {String(r.risk ?? r.title ?? "—")} · Severity: {String(r.severity ?? "—")} · Probability: {String(r.probability ?? "—")} · Owner: {String(r.owner ?? "unassigned")} · Mitigation: {String(r.mitigation ?? "—")} · Status: {String(r.status ?? "open")}</div>)}</DashboardCard>

          <DashboardCard title="D) Stakeholder Tracking">{profiles.length === 0 ? emptyLine("No stakeholder data yet. Stakeholder tracking begins once interactions are recorded.") : profiles.map((p, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-2">{String(p.name ?? "—")} · Role: {String(p.role ?? "—")} · Decision power: {String(p.decisionPower ?? p.powerLevel ?? "—")} · Influence: {String(p.influenceLevel ?? "—")} · Support: {String(p.alignmentStatus ?? "—")} · Pressure: {String(p.pressureLevel ?? "—")}</div>)}</DashboardCard>

          <DashboardCard title="E/F) Action Items + Decisions Pending">{actionQueue.length === 0 ? emptyLine("No action items yet. Actions appear as commitments and blockers are captured.") : actionQueue.slice(0, 6).map((a, idx) => <div key={idx} className="rounded-lg border border-slate-200 p-2">Action: {String(a.type ?? "—")} · Owner: {String(a.targetStakeholder ?? "unassigned")} · Due: {String((a.executionWindow as AnyRecord)?.label ?? "—")} · Dependency: {((a.dependencyChain as AnyRecord[] | undefined) ?? []).map((d) => String(d.reason)).join("; ") || "none"} · Status: pending · Urgency: {String(a.urgency ?? "—")}</div>)}</DashboardCard>

          <DashboardCard title="G/H/I) Governance, Team Health, Recommended Intervention">
            <p>Methodology alignment: {String((coordination.data?.coordination_conflict_risk as AnyRecord | undefined)?.level ?? "—")}. Reporting cadence: {String((intervention?.operationalDriftSignal as AnyRecord | undefined)?.unstableCadence ?? "—")}.</p>
            <p>PM overload: {String((intervention?.operationalDriftSignal as AnyRecord | undefined)?.pmOverloadSignal ?? "—")}. Meeting pressure: {String(stakeholders.data?.executivePressure ?? "—")}.</p>
            {interventionPopulated && intervention?.interventionRequired === true ? (
              <p>Recommended intervention: {String(intervention.recommendedInterventionType ?? "—")}. Escalation target: {String(intervention.escalationTarget ?? "none")}.</p>
            ) : (
              emptyLine("No intervention recommended. Recommendations appear when execution signals require action.")
            )}
          </DashboardCard>

          <DashboardCard title="Export-Ready Outputs"><div className="flex flex-wrap gap-2 text-xs">{["Copy executive update", "Generate status report", "Generate meeting agenda", "Generate escalation note", "Generate weekly PMO report"].map((item) => <button key={item} className="rounded-lg border border-cyan-400/40 px-2 py-1 text-cyan-900">{item}</button>)}</div></DashboardCard>

          <DashboardCard title="Missing Data Awareness"><p>Completion score: <span className="font-semibold text-slate-900">{completion}%</span></p><p>Jump to domain chats: stakeholder intelligence, delivery intelligence, risk intelligence, PMO governance, team health.</p></DashboardCard>
        </>
      ) : null}
    </div>
  );
}
