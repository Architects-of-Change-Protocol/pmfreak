"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DERIVED_LENS_METADATA } from "@/lib/workspace/derived-lens-metadata";
import { computeCapabilityRevealState, computeNavigationRail } from "@/features/runtime/capability-reveal/capability-reveal-selectors";

type UserProject = { id: string; name: string };
type DiscoverySummary = {
  version: number;
  stakeholders_json?: unknown[];
  dependencies_json?: unknown[];
  risks_json?: unknown[];
  milestones_json?: unknown[];
  deliverables_json?: unknown[];
  unknowns_json?: unknown[];
  confidence_score?: number | string;
};
type RecommendedAction = {
  id: string;
  title: string;
  recommended_action_type: string;
  impact_level: string | null;
  confidence_score: number | string;
  status: string;
  decision_reason?: string | null;
  decided_at?: string | null;
  deferred_until?: string | null;
  evidence_summary?: { raidCategory?: string; raidItemId?: string } | null;
};

type TaskDraft = {
  id: string;
  title: string;
  description: string;
  draft_status: string;
  priority: string;
  suggested_owner: string | null;
  suggested_due_window: string | null;
  suggested_due_date: string | null;
  acceptance_criteria: string[];
  checklist: string[];
  confidence_score: number | null;
  recommended_action_id: string;
  raid_item_id: string | null;
  source_payload: Record<string, unknown>;
};

type OperationalShellProps = {
  children: React.ReactNode;
  user: { fullName: string; role: string; companyName: string };
};


export function OperationalShell({ children, user }: OperationalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [discoverySummary, setDiscoverySummary] = useState<DiscoverySummary | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [recommendedActions, setRecommendedActions] = useState<RecommendedAction[]>([]);
  const [actionsFilter, setActionsFilter] = useState<string>("all");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [taskDraftPreview, setTaskDraftPreview] = useState<TaskDraft | null>(null);
  const [draftConvertingId, setDraftConvertingId] = useState<string | null>(null);
  const [draftActionError, setDraftActionError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const fromQuery = new URLSearchParams(window.location.search).get("projectId") ?? "";
    const fromStorage = window.localStorage.getItem("pmfreak.currentProjectId") ?? "";
    return fromQuery || fromStorage;
  });

  useEffect(() => {
    let active = true;
    async function load() {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { projects?: UserProject[] };
        if (active) setProjects(data.projects ?? []);
      } catch {
        if (active) {
          setProjects([]);
          setProjectsError("Project list unavailable — continue in portfolio scope.");
        }
      } finally {
        if (active) setProjectsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (projectId) globalThis.localStorage?.setItem("pmfreak.currentProjectId", projectId);
  }, [projectId]);

  // Once projects finish loading: clean stale localStorage and hydrate URL from stored id.
  // Skip on network error — a failed fetch must not incorrectly invalidate a valid stored context.
   
  useEffect(() => {
    if (projectsLoading || initializedRef.current) return;
    if (projectsError) return;
    initializedRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("projectId");
    const validIds = new Set(projects.map((p) => p.id));

    if (urlProjectId) {
      if (!validIds.has(urlProjectId)) {
        globalThis.localStorage?.removeItem("pmfreak.currentProjectId");
        queueMicrotask(() => setProjectId(""));
      }
      return;
    }

    if (projectId && validIds.has(projectId)) {
      urlParams.set("projectId", projectId);
      router.replace(`${window.location.pathname}?${urlParams.toString()}`);
    } else if (projectId && !validIds.has(projectId)) {
      globalThis.localStorage?.removeItem("pmfreak.currentProjectId");
      queueMicrotask(() => setProjectId(""));
    }
  }, [projectId, projects, projectsError, projectsLoading, router]);

  useEffect(() => {
    let active = true;
    async function loadDiscovery() {
      if (!projectId) {
        setDiscoverySummary(null);
        return;
      }
      setDiscoveryLoading(true);
      try {
        const res = await fetch(`/api/project-discovery?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = (await res.json()) as { discovery?: DiscoverySummary | null };
        if (active) setDiscoverySummary(res.ok ? data.discovery ?? null : null);
      } catch {
        if (active) setDiscoverySummary(null);
      } finally {
        if (active) setDiscoveryLoading(false);
      }
    }
    void loadDiscovery();
    return () => { active = false; };
  }, [projectId]);

  const refreshActions = async () => {
    if (!projectId) { setRecommendedActions([]); return; }
    try {
      const res = await fetch(`/api/recommended-actions?projectId=${encodeURIComponent(projectId)}&decision_fields=true`, { cache: "no-store" });
      const data = (await res.json()) as { recommendedActions?: RecommendedAction[] };
      setRecommendedActions(res.ok ? data.recommendedActions ?? [] : []);
    } catch {
      setRecommendedActions([]);
    }
  };

  useEffect(() => {
    let active = true;
    async function loadActions() {
      if (!projectId) { setRecommendedActions([]); return; }
      try {
        const res = await fetch(`/api/recommended-actions?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
        const data = (await res.json()) as { recommendedActions?: RecommendedAction[] };
        if (active) setRecommendedActions(res.ok ? data.recommendedActions ?? [] : []);
      } catch {
        if (active) setRecommendedActions([]);
      }
    }
    void loadActions();
    return () => { active = false; };
  }, [projectId]);

  const handleDecision = async (
    actionId: string,
    decision: "accepted" | "rejected" | "deferred" | "converted_to_task",
    extra?: { reason?: string; deferredUntil?: string }
  ) => {
    setDecidingId(actionId);
    setDecisionError(null);
    try {
      const res = await fetch("/api/recommended-actions/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, decision, ...extra }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setDecisionError(data.error ?? "Decision failed. Please try again.");
      } else {
        await refreshActions();
      }
    } catch {
      setDecisionError("Network error. Please try again.");
    } finally {
      setDecidingId(null);
    }
  };

  const promptReject = (actionId: string) => {
    const reason = window.prompt("Reason for rejection (optional):") ?? undefined;
    void handleDecision(actionId, "rejected", { reason: reason || undefined });
  };

  const promptDefer = (actionId: string) => {
    const until = window.prompt("Defer until (YYYY-MM-DD):");
    if (!until) return;
    void handleDecision(actionId, "deferred", { deferredUntil: new Date(until).toISOString() });
  };

  const handleConvert = async (actionId: string) => {
    setDraftConvertingId(actionId);
    setDraftActionError(null);
    try {
      const res = await fetch("/api/task-drafts/from-recommended-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendedActionId: actionId }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: TaskDraft; error?: string };
      if (!res.ok || !data.ok || !data.draft) {
        setDraftActionError(data.error ?? "Could not create task draft. Please try again.");
      } else {
        setTaskDraftPreview(data.draft);
        await refreshActions();
      }
    } catch {
      setDraftActionError("Network error. Please try again.");
    } finally {
      setDraftConvertingId(null);
    }
  };

  const handleDraftStatus = async (draftId: string, status: "reviewed" | "approved" | "discarded") => {
    setDraftActionError(null);
    try {
      const res = await fetch("/api/task-drafts/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, status }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: TaskDraft; error?: string };
      if (!res.ok || !data.ok) {
        setDraftActionError(data.error ?? "Status update failed. Please try again.");
      } else {
        setTaskDraftPreview(data.draft ?? null);
      }
    } catch {
      setDraftActionError("Network error. Please try again.");
    }
  };

  const hasProjects = projects.length > 0;
  const revealState = useMemo(() => computeCapabilityRevealState({
    planTier: "free",
    role: user.role,
    onboardingCompleted: true,
    hasProject: hasProjects,
    firstRun: false,
    evidenceSignals: hasProjects ? 2 : 0,
    operationalMemorySignals: hasProjects ? 1 : 0,
    continuitySignals: hasProjects ? 1 : 0,
    canUseAdvancedAi: true,
    canUsePortfolioMemory: true,
    canUseGovernanceDirectives: user.role === "admin" || user.role === "owner",
  }), [hasProjects, user.role]);
  const navHref = (href: string) => (projectId ? `${href}?projectId=${projectId}` : href);
  const navItems = computeNavigationRail(revealState);
  const primaryNav = navItems.filter((item) => item.idle === "text-indigo-100/90");
  const activeLens = DERIVED_LENS_METADATA.find((lens) => pathname.startsWith(lens.route) && ["overview", "delivery", "leadership", "controls"].includes(lens.lensType));
  const discoveryCounts = {
    stakeholders: discoverySummary?.stakeholders_json?.length ?? 0,
    dependencies: discoverySummary?.dependencies_json?.length ?? 0,
    risks: discoverySummary?.risks_json?.length ?? 0,
    milestones: discoverySummary?.milestones_json?.length ?? 0,
    deliverables: discoverySummary?.deliverables_json?.length ?? 0,
    unknowns: discoverySummary?.unknowns_json?.length ?? 0,
  };
  const discoveryConfidence = Math.round(Number(discoverySummary?.confidence_score ?? 0));

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto flex w-full max-w-[1540px] gap-4 px-3 py-4 md:gap-6 md:px-5 md:py-6">

        {/* ── Left rail ── */}
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[15.5rem] flex-col rounded-3xl border border-white/[0.08] bg-slate-950/80 shadow-[0_36px_80px_-55px_rgba(14,116,144,0.4)] backdrop-blur-xl lg:flex overflow-hidden">

          {/* Scrollable interior */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

            {/* Identity block */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40 p-3.5">
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/20 blur-2xl motion-safe:animate-[breathe_8s_ease-in-out_infinite]" />
              <div className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-cyan-500/15 blur-xl" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400/60 motion-safe:animate-[pulse_3s_ease-in-out_infinite]" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-indigo-200/80">PMFreak</p>
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">{user.companyName}</p>
              </div>
            </div>

            {/* Primary navigation — Start Here */}
            <nav aria-label="Primary navigation">
              <div className="space-y-1">
                <p className="mb-1.5 px-1 text-[9px] uppercase tracking-[0.3em] text-zinc-600">Start Here</p>
                {primaryNav.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={navHref(item.href)}
                      className={`group relative block overflow-hidden rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
                        isActive
                          ? `${item.active} border-opacity-100`
                          : `border-white/[0.05] bg-white/[0.01] ${item.idle} hover:border-white/[0.15] hover:bg-white/[0.04] hover:-translate-y-px`
                      }`}
                    >
                      <span className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 bg-gradient-to-r group-hover:opacity-100 ${item.accent}`} />
                      <span className="relative">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>

            <section className="rounded-2xl border border-indigo-300/15 bg-indigo-300/[0.04] p-3 shadow-[0_18px_55px_-42px_rgba(129,140,248,0.8)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-indigo-200/80">Discovery Summary</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">Operational structure inferred from canonical evidence.</p>
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                <span>Stakeholders: {discoveryCounts.stakeholders}</span>
                <span>Dependencies: {discoveryCounts.dependencies}</span>
                <span>Risks: {discoveryCounts.risks}</span>
                <span>Milestones: {discoveryCounts.milestones}</span>
                <span>Deliverables: {discoveryCounts.deliverables}</span>
                <span>Unknowns: {discoveryCounts.unknowns}</span>
              </div>
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[11px] text-indigo-100">
                Discovery Confidence: {discoveryLoading ? "Loading" : `${discoveryConfidence}%`}
              </div>
            </section>

            {/* Recommended Actions Panel */}
            {recommendedActions.length > 0 && (() => {
              const ACTION_FILTERS = ["all", "proposed", "accepted", "rejected", "deferred", "converted"] as const;
              const filtered = actionsFilter === "all"
                ? recommendedActions
                : recommendedActions.filter((a) => a.status === actionsFilter || (actionsFilter === "converted" && a.status === "converted_to_task"));
              const topAction = filtered[0] ?? null;
              return (
                <section className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-3 shadow-[0_18px_55px_-42px_rgba(251,191,36,0.5)]">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-amber-200/80">Recommended Actions</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-400">PM-reviewed action recommendations from RAID findings.</p>

                  {/* Quick filters */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ACTION_FILTERS.map((f) => (
                      <button
                        key={f}
                        onClick={() => setActionsFilter(f)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] capitalize transition-colors ${
                          actionsFilter === f
                            ? "border-amber-300/40 bg-amber-300/[0.15] text-amber-100"
                            : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Top action highlight */}
                  {topAction && (
                    <div className="mt-2 rounded-xl border border-amber-200/20 bg-black/30 p-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-300/70">Top Recommended Action</p>
                      <p className="mt-1 text-[11px] font-medium leading-4 text-slate-100">{topAction.title}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                        <span>Impact: <span className="capitalize text-slate-200">{topAction.impact_level ?? "—"}</span></span>
                        <span>Confidence: <span className="text-amber-200">{Math.round(Number(topAction.confidence_score))}%</span></span>
                        {topAction.evidence_summary?.raidCategory && (
                          <span>Source: <span className="capitalize text-slate-300">{topAction.evidence_summary.raidCategory}</span></span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Decision error */}
                  {decisionError && (
                    <p className="mt-1.5 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-2 py-1.5 text-[10px] text-rose-300">{decisionError}</p>
                  )}

                  {/* Action list */}
                  <div className="mt-2 space-y-2">
                    {filtered.slice(0, 5).map((action) => {
                      const isDeciding = decidingId === action.id;
                      const status = action.status;
                      const isTerminal = status === "rejected" || status === "converted_to_task";
                      return (
                        <div key={action.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                          <p className="text-[11px] leading-4 text-slate-200">{action.title}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                            <span className="capitalize">{action.recommended_action_type.replace(/_/g, " ")}</span>
                            {action.impact_level && <span className="capitalize">{action.impact_level}</span>}
                            <span className={`capitalize font-medium ${
                              status === "proposed" ? "text-amber-400/70" :
                              status === "accepted" ? "text-green-400/80" :
                              status === "rejected" ? "text-rose-400/70" :
                              status === "deferred" ? "text-sky-400/70" :
                              status === "converted_to_task" ? "text-indigo-400/70" :
                              "text-slate-600"
                            }`}>{status === "converted_to_task" ? "Converted" : status}</span>
                          </div>

                          {/* Decision history summary */}
                          {(status !== "proposed") && action.decided_at && (
                            <div className="mt-1 rounded-md border border-white/[0.04] bg-black/20 px-2 py-1 text-[9px] text-slate-500">
                              {status === "deferred" && action.deferred_until && (
                                <span>Deferred until {new Date(action.deferred_until).toLocaleDateString()} · </span>
                              )}
                              <span>Decided {new Date(action.decided_at).toLocaleDateString()}</span>
                              {action.decision_reason && <span> · {action.decision_reason}</span>}
                            </div>
                          )}

                          {/* Decision controls */}
                          {!isTerminal && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(status === "proposed" || status === "deferred") && (
                                <button
                                  disabled={isDeciding}
                                  onClick={() => void handleDecision(action.id, "accepted")}
                                  className="rounded border border-green-300/20 bg-green-300/[0.07] px-2 py-0.5 text-[10px] text-green-300 hover:bg-green-300/[0.15] disabled:opacity-40"
                                >
                                  Accept
                                </button>
                              )}
                              {(status === "proposed" || status === "deferred") && (
                                <button
                                  disabled={isDeciding}
                                  onClick={() => promptReject(action.id)}
                                  className="rounded border border-rose-300/20 bg-rose-300/[0.07] px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-300/[0.15] disabled:opacity-40"
                                >
                                  Reject
                                </button>
                              )}
                              {(status === "proposed") && (
                                <button
                                  disabled={isDeciding}
                                  onClick={() => promptDefer(action.id)}
                                  className="rounded border border-sky-300/20 bg-sky-300/[0.07] px-2 py-0.5 text-[10px] text-sky-300 hover:bg-sky-300/[0.15] disabled:opacity-40"
                                >
                                  Defer
                                </button>
                              )}
                              {(status === "proposed" || status === "deferred" || status === "accepted") && (
                                <button
                                  disabled={isDeciding || draftConvertingId === action.id}
                                  onClick={() => void handleConvert(action.id)}
                                  className="rounded border border-indigo-300/20 bg-indigo-300/[0.07] px-2 py-0.5 text-[10px] text-indigo-300 hover:bg-indigo-300/[0.15] disabled:opacity-40"
                                >
                                  {draftConvertingId === action.id ? "Creating…" : "Convert"}
                                </button>
                              )}
                            </div>
                          )}
                          {status === "rejected" && (
                            <p className="mt-1.5 text-[9px] text-rose-400/60">Rejected — no further actions</p>
                          )}
                          {status === "converted_to_task" && (
                            <p className="mt-1.5 text-[9px] text-indigo-400/60">
                              Converted — task draft created
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {filtered.length > 5 && (
                      <p className="px-1 text-[10px] text-slate-600">+{filtered.length - 5} more</p>
                    )}
                  </div>
                </section>
              );
            })()}

            {/* Draft Action Error (outside actions section, persists until dismissed) */}
            {draftActionError && (
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-2.5 py-2 text-[10px] text-rose-300 flex items-start justify-between gap-2">
                <span>{draftActionError}</span>
                <button onClick={() => setDraftActionError(null)} className="shrink-0 text-rose-400/60 hover:text-rose-300">✕</button>
              </div>
            )}

            {/* Task Draft Preview */}
            {taskDraftPreview && (
              <section className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.04] p-3 shadow-[0_18px_55px_-42px_rgba(167,139,250,0.5)]">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-violet-200/80">Task Draft</p>
                  <button
                    onClick={() => setTaskDraftPreview(null)}
                    className="text-[10px] text-slate-600 hover:text-slate-300"
                  >
                    ✕
                  </button>
                </div>

                <p className="mt-1.5 text-[11px] font-medium leading-4 text-slate-100">{taskDraftPreview.title}</p>

                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                  <span>Priority: <span className={`capitalize font-medium ${
                    taskDraftPreview.priority === "critical" ? "text-red-400" :
                    taskDraftPreview.priority === "high" ? "text-orange-400" :
                    taskDraftPreview.priority === "medium" ? "text-amber-400" :
                    "text-slate-300"
                  }`}>{taskDraftPreview.priority}</span></span>
                  {taskDraftPreview.suggested_owner && (
                    <span>Owner: <span className="text-slate-300">{taskDraftPreview.suggested_owner}</span></span>
                  )}
                  {taskDraftPreview.suggested_due_window && (
                    <span>Due: <span className="text-slate-300">{taskDraftPreview.suggested_due_window}</span></span>
                  )}
                  {taskDraftPreview.confidence_score !== null && (
                    <span>Confidence: <span className="text-violet-300">{Math.round(Number(taskDraftPreview.confidence_score))}%</span></span>
                  )}
                  <span className={`capitalize ${
                    taskDraftPreview.draft_status === "approved" ? "text-green-400" :
                    taskDraftPreview.draft_status === "discarded" ? "text-rose-400/70" :
                    "text-violet-300/70"
                  }`}>{taskDraftPreview.draft_status}</span>
                </div>

                {taskDraftPreview.description && (
                  <div className="mt-2 rounded-lg border border-white/[0.05] bg-black/20 px-2 py-1.5 text-[10px] leading-4 text-slate-400 line-clamp-3">
                    {taskDraftPreview.description}
                  </div>
                )}

                {taskDraftPreview.acceptance_criteria.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-violet-200/60 mb-1">Acceptance Criteria</p>
                    <ul className="space-y-0.5">
                      {taskDraftPreview.acceptance_criteria.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/50" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {taskDraftPreview.checklist.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-violet-200/60 mb-1">Checklist</p>
                    <ul className="space-y-0.5">
                      {taskDraftPreview.checklist.slice(0, 4).map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-slate-400">
                          <span className="mt-px text-violet-400/50">☐</span>
                          {c}
                        </li>
                      ))}
                      {taskDraftPreview.checklist.length > 4 && (
                        <li className="text-[10px] text-slate-600">+{taskDraftPreview.checklist.length - 4} more steps</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Draft action controls */}
                {(taskDraftPreview.draft_status === "draft" || taskDraftPreview.draft_status === "reviewed") && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    <button
                      onClick={() => void handleDraftStatus(taskDraftPreview.id, "approved")}
                      className="rounded border border-green-300/20 bg-green-300/[0.07] px-2 py-0.5 text-[10px] text-green-300 hover:bg-green-300/[0.15]"
                    >
                      Approve Draft
                    </button>
                    <button
                      onClick={() => void handleDraftStatus(taskDraftPreview.id, "discarded")}
                      className="rounded border border-rose-300/20 bg-rose-300/[0.07] px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-300/[0.15]"
                    >
                      Discard Draft
                    </button>
                    <button
                      onClick={() => void handleDraftStatus(taskDraftPreview.id, "reviewed")}
                      className="rounded border border-white/[0.10] bg-white/[0.02] px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      Keep as Draft
                    </button>
                  </div>
                )}
                {taskDraftPreview.draft_status === "approved" && (
                  <p className="mt-1.5 text-[9px] text-green-400/70">Draft approved — awaiting task conversion in H6</p>
                )}
                {taskDraftPreview.draft_status === "discarded" && (
                  <p className="mt-1.5 text-[9px] text-rose-400/60">Draft discarded</p>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-3 shadow-[0_18px_55px_-42px_rgba(34,211,238,0.8)]">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Project Evidence</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">Evidence vault for real project artifacts.</p>
              <div className="mt-3 space-y-1.5">
                <Link
                  href={navHref("/evidence")}
                  className="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[11px] text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-300/[0.08]"
                >
                  Upload Documents
                </Link>
                <Link
                  href={navHref("/evidence")}
                  className="block rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  View Evidence
                </Link>
                <Link
                  href={navHref("/evidence")}
                  className="block rounded-lg border border-rose-300/15 bg-rose-300/[0.03] px-2.5 py-2 text-[11px] text-rose-100 transition hover:border-rose-200/30 hover:bg-rose-300/[0.08]"
                >
                  Delete Evidence
                </Link>
              </div>
            </section>
          </div>

          {/* User block — pinned bottom */}
          <div className="shrink-0 border-t border-white/[0.07] px-3.5 py-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-200">{user.fullName}</p>
                <p className="truncate text-[10px] text-zinc-600">{user.role}</p>
              </div>
              <Link
                href="/logout"
                className="shrink-0 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-zinc-600 transition-colors hover:border-white/20 hover:text-slate-300"
              >
                Sign out
              </Link>
            </div>
          </div>
        </aside>

        {/* ── Main content region ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 md:gap-5">

          {/* Mobile nav strip */}
          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-3 backdrop-blur-xl lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400/50 motion-safe:animate-[pulse_3s_ease-in-out_infinite]" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-400" />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-300/80">PMFreak</p>
              </div>
              <span className="text-[10px] text-zinc-600">{user.companyName}</span>
            </div>
            <div className="flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {primaryNav.map((item) => (
                <Link
                  key={item.label}
                  href={navHref(item.href)}
                  className={`shrink-0 snap-start rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    pathname.startsWith(item.href)
                      ? "border-cyan-200/30 bg-cyan-300/[0.08] text-cyan-100"
                      : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Page content */}
          {activeLens && (
            <p className="px-1 text-[11px] text-slate-500">{activeLens.breadcrumbLabel}</p>
          )}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
