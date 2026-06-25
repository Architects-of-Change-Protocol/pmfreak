"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import type {
  PMOInterventionAction,
  PMOInterventionGenerateResult,
  PMOInterventionStatus,
  PMOInterventionPriority,
  PMOInterventionActionType,
} from "@/lib/pmo-intervention";

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  proposed:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  approved:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  in_progress: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  completed:   "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  rejected:    "bg-red-600/20 text-red-300 border-red-600/30",
  dismissed:   "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
  cancelled:   "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-600/20 text-red-300 border-red-600/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low:      "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
};

// ─── Shared components ────────────────────────────────────────────────────────

function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  const cls = styles[value] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function SummaryCard({ label, value, highlight, sub }: { label: string; value: string | number; highlight?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({
  action,
  expanded,
  onToggle,
  onStatusChange,
  loading,
}: {
  action: PMOInterventionAction;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (actionId: string, status: PMOInterventionStatus, reason?: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");

  const canApprove   = action.status === "proposed";
  const canReject    = action.status === "proposed";
  const canDismiss   = action.status === "proposed";
  const canStart     = action.status === "approved";
  const canCancel    = action.status === "approved" || action.status === "in_progress";
  const canComplete  = action.status === "in_progress";
  const isTerminal   = ["completed", "rejected", "dismissed", "cancelled"].includes(action.status);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-4"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge value={action.priority} styles={PRIORITY_STYLES} />
            <Badge value={action.status} styles={STATUS_STYLES} />
            <span className="text-xs text-zinc-400">{action.actionType.replace(/_/g, " ")}</span>
          </div>
          <p className="text-sm font-medium text-white truncate">{action.actionTitle}</p>
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{action.actionDescription}</p>
        </div>
        <span className="text-zinc-500 text-xs shrink-0 mt-1">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {action.pmId && <div><span className="text-zinc-500">PM ID</span><p className="text-white font-mono">{action.pmId}</p></div>}
            {action.projectId && <div><span className="text-zinc-500">Project ID</span><p className="text-white font-mono">{action.projectId}</p></div>}
            {action.targetName && <div><span className="text-zinc-500">Target</span><p className="text-white">{action.targetName}</p></div>}
            <div><span className="text-zinc-500">Source</span><p className="text-white">{action.sourceType}</p></div>
            {action.sourceViolationId && <div><span className="text-zinc-500">Violation</span><p className="text-white font-mono">{action.sourceViolationId}</p></div>}
            <div><span className="text-zinc-500">Approval</span><p className="text-white">{action.approvalStatus}</p></div>
            <div><span className="text-zinc-500">Created</span><p className="text-white">{new Date(action.createdAt).toLocaleString()}</p></div>
          </div>

          {action.recommendation && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Recommendation</p>
              <p className="text-sm text-zinc-200">{action.recommendation}</p>
            </div>
          )}

          {action.decisionReason && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Decision Reason</p>
              <p className="text-sm text-zinc-200">{action.decisionReason}</p>
            </div>
          )}

          {action.completionNotes && (
            <div>
              <p className="text-xs text-zinc-500 mb-1">Completion Notes</p>
              <p className="text-sm text-zinc-200">{action.completionNotes}</p>
            </div>
          )}

          {!isTerminal && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason / notes (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
              <div className="flex flex-wrap gap-2">
                {canApprove && (
                  <button
                    disabled={loading}
                    onClick={() => { onStatusChange(action.id, "approved", reason); setReason(""); }}
                    className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {canReject && (
                  <button
                    disabled={loading}
                    onClick={() => { onStatusChange(action.id, "rejected", reason); setReason(""); }}
                    className="rounded-lg bg-red-600/20 border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-600/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                )}
                {canDismiss && (
                  <button
                    disabled={loading}
                    onClick={() => { onStatusChange(action.id, "dismissed", reason); setReason(""); }}
                    className="rounded-lg bg-zinc-600/20 border border-zinc-500/30 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600/30 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                )}
                {canStart && (
                  <button
                    disabled={loading}
                    onClick={() => { onStatusChange(action.id, "in_progress", reason); setReason(""); }}
                    className="rounded-lg bg-amber-600/20 border border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-600/30 disabled:opacity-50"
                  >
                    Start
                  </button>
                )}
                {canComplete && (
                  <button
                    disabled={loading}
                    onClick={() => { onStatusChange(action.id, "completed", reason); setReason(""); }}
                    className="rounded-lg bg-zinc-500/20 border border-zinc-400/30 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-500/30 disabled:opacity-50"
                  >
                    Complete
                  </button>
                )}
                {canCancel && (
                  <button
                    disabled={loading}
                    onClick={() => { onStatusChange(action.id, "cancelled", reason); setReason(""); }}
                    className="rounded-lg bg-zinc-700/20 border border-zinc-600/30 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700/30 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PMOInterventionsPage() {
  const [actions, setActions] = useState<PMOInterventionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<PMOInterventionGenerateResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterActionType, setFilterActionType] = useState<string>("");

  const filtersRef = useRef({ filterStatus: "", filterPriority: "", filterActionType: "" });

  const fetchActions = useCallback(async () => {
    try {
      const { filterStatus: s, filterPriority: p, filterActionType: a } = filtersRef.current;
      const params = new URLSearchParams();
      if (s) params.set("status", s);
      if (p) params.set("priority", p);
      if (a) params.set("actionType", a);
      const res = await fetch(`/api/pmo-interventions?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setActions(json.data);
        setError(null);
      } else {
        setError(json.error?.message ?? "Failed to load actions.");
      }
    } catch {
      setError("Network error loading actions.");
    } finally {
      setLoading(false);
    }
  }, []);

  // fetchActions is stable (useCallback with [] deps) — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchActions(); }, [fetchActions]);

  function applyFilterStatus(val: string) {
    filtersRef.current.filterStatus = val;
    setFilterStatus(val);
    void fetchActions();
  }

  function applyFilterPriority(val: string) {
    filtersRef.current.filterPriority = val;
    setFilterPriority(val);
    void fetchActions();
  }

  function applyFilterActionType(val: string) {
    filtersRef.current.filterActionType = val;
    setFilterActionType(val);
    void fetchActions();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateResult(null);
    setError(null);
    try {
      const res = await fetch("/api/pmo-interventions/generate", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setGenerateResult(json.data);
        await fetchActions();
      } else {
        setError(json.error?.message ?? "Generation failed.");
      }
    } catch {
      setError("Network error during generation.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(actionId: string, status: PMOInterventionStatus, reason?: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/pmo-interventions/${actionId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(status === "completed" ? { status, completionNotes: reason } : { status, decisionReason: reason }),
      });
      const json = await res.json();
      if (json.ok) {
        setActions((prev) => prev.map((a) => (a.id === actionId ? json.data : a)));
      } else {
        setError(json.error?.message ?? "Status update failed.");
      }
    } catch {
      setError("Network error updating action.");
    } finally {
      setActionLoading(false);
    }
  }

  // Summary counts
  const byStatus = (s: PMOInterventionStatus) => actions.filter((a) => a.status === s).length;
  const byPriority = (p: PMOInterventionPriority) => actions.filter((a) => a.priority === p).length;

  const STATUS_GROUPS: PMOInterventionStatus[] = ["proposed", "approved", "in_progress", "completed", "dismissed", "rejected", "cancelled"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">PMO Intervention Center</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Human-governed action queue derived from PMO governance violations. All actions require explicit human approval before execution.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
            <Link href="/pmo-governance-compliance" className="hover:text-white">Governance Compliance</Link>
            <span>·</span>
            <Link href="/pm-registry" className="hover:text-white">PM Registry</Link>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={fetchActions}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-xl border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm text-blue-300 hover:bg-blue-600/30 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Actions"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-600/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Generation result banner */}
      {generateResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-300 space-y-1">
          <p className="font-medium">Actions generated from governance snapshot</p>
          <div className="flex flex-wrap gap-4 text-xs text-emerald-200">
            <span>Created: {generateResult.created_actions.length}</span>
            <span>Skipped duplicates: {generateResult.skipped_duplicates}</span>
            <span>Existing open: {generateResult.existing_open_actions}</span>
            {generateResult.source_snapshot_id && <span>Snapshot: {generateResult.source_snapshot_id}</span>}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Proposed" value={byStatus("proposed")} highlight="text-blue-300" />
        <SummaryCard label="Approved" value={byStatus("approved")} highlight="text-emerald-300" />
        <SummaryCard label="In Progress" value={byStatus("in_progress")} highlight="text-amber-300" />
        <SummaryCard label="Completed" value={byStatus("completed")} />
        <SummaryCard label="Critical" value={byPriority("critical")} highlight="text-red-300" />
        <SummaryCard label="High Priority" value={byPriority("high")} highlight="text-orange-300" />
        <SummaryCard label="Pending Approval" value={actions.filter((a) => a.approvalStatus === "pending" && a.status === "proposed").length} />
        <SummaryCard label="Dismissed / Rejected" value={byStatus("dismissed") + byStatus("rejected")} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => applyFilterStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {(["proposed","approved","in_progress","completed","dismissed","rejected","cancelled"] as PMOInterventionStatus[]).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => applyFilterPriority(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="">All Priorities</option>
          {(["critical","high","medium","low"] as PMOInterventionPriority[]).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={filterActionType}
          onChange={(e) => applyFilterActionType(e.target.value)}
          className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="">All Action Types</option>
          {([
            "complete_pm_profile","generate_capacity_snapshot","review_capacity_overload",
            "generate_performance_snapshot","improve_evidence_coverage","escalate_critical_pm_risk",
            "review_pm_performance_risk","review_assignment_hygiene","review_evidence_quality",
            "review_intervention_readiness","manual_review",
          ] as PMOInterventionActionType[]).map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Action queue grouped by status */}
      {loading ? (
        <div className="text-sm text-zinc-500 text-center py-12">Loading actions...</div>
      ) : actions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <p className="text-zinc-400 text-sm">No intervention actions found.</p>
          <p className="text-zinc-500 text-xs mt-2">Use &ldquo;Generate Actions&rdquo; to derive actions from governance violations.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {STATUS_GROUPS.map((statusGroup) => {
            const groupActions = actions.filter((a) => a.status === statusGroup);
            if (groupActions.length === 0) return null;
            return (
              <section key={statusGroup}>
                <div className="mb-3 flex items-center gap-3">
                  <Badge value={statusGroup} styles={STATUS_STYLES} />
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-300">{groupActions.length}</span>
                </div>
                <div className="space-y-3">
                  {groupActions.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      expanded={expandedId === action.id}
                      onToggle={() => setExpandedId((prev) => (prev === action.id ? null : action.id))}
                      onStatusChange={handleStatusChange}
                      loading={actionLoading}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
