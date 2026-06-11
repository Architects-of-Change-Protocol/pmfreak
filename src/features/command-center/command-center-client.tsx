"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeCapabilityRevealState } from "@/features/runtime/capability-reveal/capability-reveal-selectors";
import type { OperationalGovernanceBrief } from "@/lib/projects/first-insight";
import { OperationalDecisionLoop } from "@/features/command-center/operational-decision-loop";

type AnyRecord = Record<string, unknown>;
type UserProject = { id: string; name: string };
type DomainStatus = "active" | "watching" | "needs-data" | "simulated";

type VaultIntakeResult = {
  documentId: string;
  risksDetected: number;
  issuesDetected: number;
  dependenciesDetected: number;
  actionsDetected: number;
  decisionsDetected: number;
  raidItemsCreated: number;
  raidItemsUpdated: number;
  raidSnapshot: { risks: number; issues: number; dependencies: number; assumptions: number };
  confidenceScore: number;
  ingestionSummary: string;
  ingestionStatus: string;
  classification: string;
  executiveSynthesisUpdated: boolean;
  errors: string[];
};

type DomainAgent = {
  id: string;
  label: string;
  role: string;
  status: DomainStatus;
  route?: string;
};

class IntelligenceFetchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "IntelligenceFetchError";
  }
}

const fetcher = async ([url, projectId, workspaceId]: [string, string, string]) => {
  const params = new URLSearchParams({ projectId });
  if (workspaceId) params.set("workspaceId", workspaceId);
  const response = await fetch(`${url}?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new IntelligenceFetchError(`Failed ${url}`, response.status);
  return response.json();
};

const isAuthError = (err: unknown) => err instanceof IntelligenceFetchError && (err.status === 401 || err.status === 403);

const PROMPTS = [
  "Review today's operational risks",
  "Explain the escalation chain",
  "Generate executive briefing",
  "Show stakeholder pressure",
  "What needs my attention first?",
  "Summarize blockers and dependencies",
];

const LOW_DATA_ACTIONS = ["Paste meeting notes", "Add blocker", "Add stakeholder update", "Upload project docs", "Record decision", "Add risk"];

function statusTone(status: DomainStatus) {
  if (status === "active") return "text-cyan-200 border-cyan-300/30 bg-cyan-300/[0.08]";
  if (status === "watching") return "text-amber-200 border-amber-300/30 bg-amber-300/[0.08]";
  if (status === "simulated") return "text-violet-200 border-violet-300/30 bg-violet-300/[0.08]";
  return "text-slate-300 border-white/10 bg-white/[0.04]";
}

export function CommandCenterClient({ firstRun = false, projectId, projectName, workspaceId, projects, role, onboardingCompleted, planTier, canUseAdvancedAi, canUsePortfolioMemory, canUseGovernanceDirectives, initialBrief, briefGenerationFailed = false }: { firstRun?: boolean; projectId: string; projectName: string; workspaceId: string; projects: UserProject[]; role: string; onboardingCompleted: boolean; planTier: "free" | "pro" | "pmo"; canUseAdvancedAi: boolean; canUsePortfolioMemory: boolean; canUseGovernanceDirectives: boolean; initialBrief?: OperationalGovernanceBrief | null; briefGenerationFailed?: boolean; }) {
  const router = useRouter();
  const swrOptions = { refreshInterval: 20000, revalidateOnFocus: true, dedupingInterval: 3000 };
  const key = (path: string): [string, string, string] => [path, projectId, workspaceId];

  const risk = useSWR(key("/api/intelligence/execution-risk"), fetcher, swrOptions);
  const stakeholders = useSWR(key("/api/intelligence/stakeholders"), fetcher, swrOptions);
  const interventions = useSWR(key("/api/intelligence/interventions"), fetcher, swrOptions);
  const coordination = useSWR(key("/api/intelligence/coordination"), fetcher, swrOptions);
  const liveOps = useSWR(key("/api/intelligence/operational-live"), fetcher, swrOptions);

  const allEndpoints = [risk, stakeholders, interventions, coordination, liveOps];
  const loading = allEndpoints.some((r) => r.isLoading);
  const anyAuthError = allEndpoints.some((r) => isAuthError(r.error));
  const lastSync = allEndpoints.map((r) => r.data?.generatedAt as string | undefined).filter(Boolean).sort().at(-1);
  const [activeDomainId, setActiveDomainId] = useState("core");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [interactionState, setInteractionState] = useState<"idle" | "drafted">("idle");
  const [brief, setBrief] = useState<OperationalGovernanceBrief | null>(initialBrief ?? null);
  const [briefFallback, setBriefFallback] = useState(briefGenerationFailed);
  const [retryingBrief, setRetryingBrief] = useState(false);
  const [vaultNotes, setVaultNotes] = useState("");
  const [vaultIntakeResult, setVaultIntakeResult] = useState<VaultIntakeResult | null>(null);
  const [vaultIntakeError, setVaultIntakeError] = useState("");
  const [analyzingVaultNotes, setAnalyzingVaultNotes] = useState(false);

  const evidenceSignals = useMemo(() => {
    const queueLen = (coordination.data?.coordination?.operational_priority_queue?.actions ?? coordination.data?.operational_priority_queue?.actions ?? []).length;
    const timelineEvents = liveOps.data?.timeline?.events?.length ?? 0;
    const endpointSignals = [risk.data, stakeholders.data, interventions.data, coordination.data, liveOps.data].filter(Boolean).length;
    return queueLen + timelineEvents + endpointSignals;
  }, [coordination.data, interventions.data, liveOps.data, risk.data, stakeholders.data]);

  const revealState = useMemo(() => computeCapabilityRevealState({
    planTier,
    role,
    onboardingCompleted,
    hasProject: Boolean(projectId),
    firstRun,
    evidenceSignals,
    operationalMemorySignals: liveOps.data?.timeline?.events?.length ?? 0,
    continuitySignals: (coordination.data?.coordination?.operational_priority_queue?.actions ?? coordination.data?.operational_priority_queue?.actions ?? []).length,
    canUseAdvancedAi,
    canUsePortfolioMemory,
    canUseGovernanceDirectives,
  }), [canUseAdvancedAi, canUseGovernanceDirectives, canUsePortfolioMemory, coordination.data, evidenceSignals, firstRun, liveOps.data?.timeline?.events?.length, onboardingCompleted, planTier, projectId, role]);

  const hasEvidence = revealState.evidenceDensity === "moderate" || revealState.evidenceDensity === "high";

  const domains: DomainAgent[] = [
    { id: "core", label: "PMFreak Core", role: "Central operational cognition runtime", status: hasEvidence ? "active" : "watching" },
    { id: "pmo", label: "PMO", role: "Governance, escalation and execution assurance", status: revealState.unlockedDomains.includes("governance") ? "active" : "watching", route: "/executive" },
    { id: "projects", label: "Projects", role: "Project-scoped operational contexts", status: "active", route: "/projects" },
    { id: "risks", label: "Risks", role: "Detects delivery risk and dependency propagation", status: revealState.unlockedDomains.includes("risks") && risk.data ? "active" : (revealState.unlockedDomains.includes("risks") ? "watching" : "needs-data"), route: "/change-detection" },
    { id: "stakeholders", label: "Stakeholders", role: "Monitors alignment drift and pressure", status: revealState.unlockedDomains.includes("stakeholders") && stakeholders.data ? "active" : (revealState.unlockedDomains.includes("stakeholders") ? "watching" : "needs-data"), route: "/stakeholder-intel" },
    { id: "scope", label: "Scope", role: "Tracks scope pressure and variance", status: revealState.unlockedDomains.includes("scope") ? "watching" : "simulated" },
    { id: "delivery", label: "Delivery", role: "Execution cadence and blocker dynamics", status: revealState.unlockedDomains.includes("delivery") && interventions.data ? "active" : "watching" },
    { id: "coordination", label: "Coordination", role: "Detects collapse risk and handoff failure", status: revealState.unlockedDomains.includes("coordination") && coordination.data ? "active" : (revealState.unlockedDomains.includes("coordination") ? "watching" : "needs-data") },
    { id: "interventions", label: "Interventions", role: "Recommends stabilizing interventions", status: revealState.unlockedDomains.includes("interventions") ? (interventions.data ? "watching" : "needs-data") : "needs-data" },
    { id: "lessons", label: "Lessons Learned", role: "Extracts reusable operational patterns", status: revealState.unlockedDomains.includes("lessons") ? "watching" : "simulated" },
    { id: "executive", label: "Executive", role: "Executive synthesis and reporting", status: revealState.unlockedDomains.includes("executive") ? "active" : "watching", route: "/executive" },
    { id: "vault", label: "Vault", role: "Operational evidence intake", status: "watching", route: "/upload" },
    { id: "memory", label: "Memory", role: "Semantic operational memory", status: "watching", route: "/operational-memory" },
  ];

  if (anyAuthError) {
    return <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] p-6"><p className="text-sm font-semibold text-rose-200">Intelligence access denied</p><p className="mt-1 text-xs text-slate-400">One or more intelligence endpoints rejected the project scope.</p></div>;
  }

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId && newId !== projectId) router.push(`/command-center?projectId=${encodeURIComponent(newId)}`);
  };

  const queueActions = (coordination.data?.coordination?.operational_priority_queue?.actions ?? coordination.data?.operational_priority_queue?.actions ?? []) as AnyRecord[];
  const briefRiskItems = (brief?.topExecutionRisks ?? []).slice(0, 3).map((item) => `${item.severity.toUpperCase()}: ${item.title}`);
  const topAttention = [
    ...briefRiskItems,
    risk.data?.overallRisk ? `Delivery risk is ${String(risk.data?.overallRisk)}.` : null,
    stakeholders.data?.executivePressure ? `Stakeholder pressure is ${String(stakeholders.data?.executivePressure)}.` : null,
    queueActions.length ? `${queueActions.length} coordinated interventions are queued.` : null,
    liveOps.data?.timeline?.escalationChain?.length ? `Escalation chain depth: ${String(liveOps.data.timeline.escalationChain.length)}.` : null,
  ].filter(Boolean).slice(0, 3) as string[];


  const raidSnapshot = brief?.detectedRaidOverview?.snapshot ?? vaultIntakeResult?.raidSnapshot ?? { risks: 0, issues: 0, dependencies: 0, assumptions: 0 };
  const raidHealthScore = brief?.detectedRaidOverview?.healthScore ?? null;

  const suggestedBriefPrompts = brief ? [
    "Turn this brief into a 7-day governance plan",
    "Draft stakeholder alignment actions",
    "Create the first RAID checkpoint",
    "Explain the top execution risk",
  ] : PROMPTS;

  const analyzeVaultNotes = async () => {
    if (!vaultNotes.trim()) {
      setVaultIntakeError("Paste notes before analyzing.");
      return;
    }
    setAnalyzingVaultNotes(true);
    setVaultIntakeError("");
    setVaultIntakeResult(null);
    try {
      const response = await fetch("/api/vault/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, projectId, rawContent: vaultNotes, sourceType: "meeting_notes" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "vault_intake_failed");
      setVaultIntakeResult(payload);
      setVaultNotes("");
      risk.mutate();
      stakeholders.mutate();
      interventions.mutate();
      coordination.mutate();
      liveOps.mutate();
      void retryBrief();
    } catch (error) {
      setVaultIntakeError(error instanceof Error ? error.message : "Vault intake failed.");
    } finally {
      setAnalyzingVaultNotes(false);
    }
  };

  const retryBrief = async () => {
    setRetryingBrief(true);
    setBriefFallback(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/operational-governance-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!response.ok) throw new Error("retry_failed");
      const payload = await response.json();
      setBrief(payload.brief ?? null);
    } catch {
      setBriefFallback(true);
    } finally {
      setRetryingBrief(false);
    }
  };

  const briefing = hasEvidence
    ? [
      "PMFreak Core is watching this project's operational signals.",
      risk.data?.activeEscalationRisk ? `Escalation posture: ${String(risk.data.activeEscalationRisk)}.` : null,
      interventions.data?.intervention?.interventionUrgency ? `Intervention urgency: ${String(interventions.data.intervention.interventionUrgency)}.` : null,
      stakeholders.data?.escalationTrajectory ? `Stakeholder trajectory: ${String(stakeholders.data.escalationTrajectory)}.` : null,
    ].filter(Boolean).join(" ")
    : "PMFreak does not have enough operational evidence yet. Add meeting notes, blockers, risks, or stakeholder updates to activate deeper reasoning.";

  return (
    <div className="space-y-4 pb-8">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Command Center Runtime</p>
            <h1 className="text-xl font-semibold text-slate-100">Conversational Operational Shell</h1>
            <p className="text-xs text-slate-400">{loading ? "Refreshing intelligence..." : `Last sync: ${lastSync ? new Date(lastSync).toLocaleString() : "Awaiting first sync"}`}</p>
          </div>
          <div>{projects.length > 1 ? <select value={projectId} onChange={handleProjectChange} className="rounded-lg border border-white/15 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-100">{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <span className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300">{projectName}</span>}</div>
        </div>
      </header>

      <OperationalDecisionLoop workspaceId={workspaceId} projectId={projectId} />

      <section className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">Domains & agents</p>
          <div className="space-y-2">
            {domains.map((d) => (
              <button key={d.id} onClick={() => setActiveDomainId(d.id)} className={`w-full rounded-xl border px-3 py-2 text-left ${activeDomainId === d.id ? "border-cyan-300/40 bg-cyan-300/[0.08]" : "border-white/10 bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-100">{d.label}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusTone(d.status)}`}>{d.status}</span></div>
                <p className="mt-1 text-[11px] text-slate-400">{d.role}</p>
                {d.route && <Link href={`${d.route}?projectId=${encodeURIComponent(projectId)}`} className="mt-1 inline-block text-[11px] text-cyan-300">Open module →</Link>}
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-indigo-300">PMFreak Core</p>
            <p className="mt-2 text-lg font-medium text-slate-100">Based on your PMO and project setup, I detected the following execution signals…</p>
            <p className="mt-2 text-sm text-slate-300">{brief ? brief.recommendedNextAction : (firstRun ? "PMFreak will begin learning from blockers, meetings, stakeholders, risks, and decisions as they enter the Vault." : briefing)}</p>
            {briefFallback && <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3"><p className="text-sm text-amber-100">Project created. Initial governance brief could not be generated yet.</p><button type="button" onClick={retryBrief} disabled={retryingBrief} className="mt-2 rounded-lg border border-amber-200/40 px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50">{retryingBrief ? "Retrying…" : "Retry brief generation"}</button></div>}
            {firstRun && !brief && <p className="mt-2 text-xs text-slate-400">The runtime gets smarter as the Vault receives operational nutrients. Start by adding context; deeper intelligence requires evidence.</p>}
            <p className="mt-2 text-xs text-cyan-200">Reveal stage: {revealState.stage} · Evidence: {revealState.evidenceDensity} · Continuity: {revealState.continuityMaturity}{brief ? ` · Brief confidence: ${brief.confidenceScore}%` : ""}</p>
            <ul className="mt-2 space-y-1">{revealState.educationalHints.slice(0,2).map((h)=> <li key={h} className="text-xs text-slate-400">• {h}</li>)}</ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">Top execution risks</p>
            <ul className="mt-2 space-y-2">{topAttention.length ? topAttention.slice(0,3).map((item) => <li key={item} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-slate-200">{item}</li>) : <li className="rounded-lg border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-sm text-amber-100">Not enough operational evidence yet.</li>}</ul>
          </div>

          {brief && <div>
            <p className="text-xs font-semibold text-slate-300">Governance gaps</p>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">{brief.governanceGaps.slice(0,4).map((gap) => <li key={gap} className="rounded-lg border border-indigo-300/15 bg-indigo-300/[0.04] px-3 py-2 text-xs text-indigo-100">{gap}</li>)}</ul>
          </div>}

          {brief && <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
            <p className="text-xs font-semibold text-cyan-100">Recommended next action</p>
            <p className="mt-1 text-sm text-slate-200">{brief.recommendedNextAction}</p>
            <p className="mt-2 text-[11px] text-cyan-200/80">First intervention: {brief.firstInterventionSuggestion}</p>
          </div>}

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/70">RAID Snapshot</p>
                <p className="mt-1 text-sm text-slate-300">Open PMO intelligence items generated from deterministic Vault evidence.</p>
              </div>
              {raidHealthScore !== null && <span className="rounded-full border border-cyan-300/30 px-2 py-1 text-[10px] text-cyan-100">Health {raidHealthScore}</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3"><p className="text-slate-400">Risks</p><p className="mt-1 text-xl font-semibold text-rose-100">{raidSnapshot.risks}</p></div>
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3"><p className="text-slate-400">Issues</p><p className="mt-1 text-xl font-semibold text-amber-100">{raidSnapshot.issues}</p></div>
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3"><p className="text-slate-400">Dependencies</p><p className="mt-1 text-xl font-semibold text-cyan-100">{raidSnapshot.dependencies}</p></div>
              <div className="rounded-lg border border-white/10 bg-slate-950/35 p-3"><p className="text-slate-400">Assumptions</p><p className="mt-1 text-xl font-semibold text-violet-100">{raidSnapshot.assumptions}</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-cyan-300">Vault Intake Panel</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">Paste Notes</p>
                <p className="mt-1 text-xs text-slate-400">Meeting notes, emails, transcripts, decisions, RAID snippets, and project updates become operational evidence.</p>
              </div>
              <span className="rounded-full border border-cyan-300/30 px-2 py-1 text-[10px] text-cyan-200">deterministic · no LLM</span>
            </div>
            <textarea
              value={vaultNotes}
              onChange={(e) => setVaultNotes(e.target.value)}
              rows={6}
              className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
              placeholder="El proveedor no entregará el firewall hasta el 15 de julio. Carlos actualizará el cronograma. La instalación depende del acceso al sitio."
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">Document persists first; signal extraction and synthesis updates run after evidence is safe.</p>
              <button
                type="button"
                onClick={analyzeVaultNotes}
                disabled={analyzingVaultNotes || !vaultNotes.trim()}
                className="rounded-lg border border-cyan-300/40 bg-cyan-300/[0.08] px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {analyzingVaultNotes ? "Analyzing…" : "Analyze Notes"}
              </button>
            </div>
            {vaultIntakeError && <p className="mt-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.06] px-3 py-2 text-xs text-rose-100">{vaultIntakeError}</p>}
            {vaultIntakeResult && (
              <div className="mt-3 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.06] p-3 text-sm text-emerald-50">
                <p className="font-semibold">Meeting captured.</p>
                <p>Risk created: {vaultIntakeResult.raidSnapshot.risks}.</p>
                <p>Issue created: {vaultIntakeResult.raidSnapshot.issues}.</p>
                <p>Dependency created: {vaultIntakeResult.raidSnapshot.dependencies}.</p>
                <p>Assumptions created: {vaultIntakeResult.raidSnapshot.assumptions} · Duplicates updated: {vaultIntakeResult.raidItemsUpdated}.</p>
                <p>Signals: {vaultIntakeResult.risksDetected} risks · {vaultIntakeResult.issuesDetected} issues · {vaultIntakeResult.dependenciesDetected} dependencies · {vaultIntakeResult.actionsDetected} actions · {vaultIntakeResult.decisionsDetected} decisions.</p>
                <p className="mt-2 text-xs text-emerald-100/80">RAID Snapshot updated. Project Health recalculated. Executive synthesis {vaultIntakeResult.executiveSynthesisUpdated ? "updated" : "not updated"}. Classification: {vaultIntakeResult.classification}. Confidence: {vaultIntakeResult.confidenceScore}%.</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">Suggested prompt chips</p>
            <div className="mt-2 flex flex-wrap gap-2">{suggestedBriefPrompts.map((prompt) => <button key={prompt} onClick={() => { setDraftPrompt(prompt); setInteractionState("drafted"); }} className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]">{prompt}</button>)}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Conversation input (placeholder)</p>
            <textarea value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.03] p-2 text-sm text-slate-100 outline-none" placeholder="Ask PMFreak Core what needs attention first..." />
            <div className="mt-2 flex items-center justify-between"><p className="text-[11px] text-slate-500">{interactionState === "drafted" ? "Draft captured. Live execution will be wired to runtime chat." : "No live chat call is executed in this shell yet."}</p><button onClick={() => setInteractionState("drafted")} className="rounded-lg border border-cyan-300/40 px-3 py-1.5 text-xs text-cyan-200">Save draft</button></div>
          </div>

          {!hasEvidence && <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3"><p className="text-sm text-amber-100">Not enough operational evidence yet.</p><div className="mt-2 flex flex-wrap gap-2">{LOW_DATA_ACTIONS.map((a) => <span key={a} className="rounded-full border border-amber-300/30 px-2 py-1 text-[11px] text-amber-200">{a}</span>)}</div></div>}
        </main>

        <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Evidence & trust context</p>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300"><p className="text-slate-100">Active project</p><p>{projectName}</p><p className="mt-2 text-slate-100">Runtime scope</p><p>workspaceId: {workspaceId.slice(0, 8)}… · projectId: {projectId.slice(0, 8)}…</p></div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300"><p className="text-slate-100">Top signals</p><ul className="mt-1 list-disc space-y-1 pl-4"><li>Execution risk: {String(risk.data?.overallRisk ?? "needs more evidence")}</li><li>Stakeholder pressure: {String(stakeholders.data?.executivePressure ?? "needs more evidence")}</li><li>Coordination urgency: {String(coordination.data?.coordination?.machineOutput?.coordination_urgency ?? "needs more evidence")}</li></ul></div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-slate-300"><p className="text-slate-100">Interventions & lineage</p><p>Active interventions: {String(queueActions.length)}</p><p>Evidence sources: execution-risk, stakeholders, interventions, coordination, operational-live</p><p>Confidence label: {brief ? `${brief.confidenceScore}% from initial governance brief` : (hasEvidence ? "inferred from live endpoints" : "needs more evidence")}</p><p>Simulation label: Scope/Lessons domains currently simulated.</p></div>
        </aside>
      </section>
    </div>
  );
}
