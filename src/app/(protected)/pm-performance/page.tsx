"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type CapacityContext = {
  capacity_snapshot_id: string;
  capacity_status: string;
  burn_risk: string;
  utilization_percentage: number;
  generated_at: string;
  assignment_capacity?: {
    assignment_capacity_status?: string;
    assignment_overload_risk?: string;
    assignment_capacity_utilization?: number;
    recommendations?: Array<{ type: string; severity: string; message: string }>;
  } | null;
} | null;

type EvidenceConfidence = {
  evidence_completeness:    number;
  confidence_level:         "high" | "medium" | "low" | "very_low";
  available_source_count:   number;
  missing_source_count:     number;
  total_source_count:       number;
  score_interpretation:     "evidence_backed" | "partially_evidence_backed" | "low_confidence_provisional";
  neutral_baseline_domains: string[];
  missing_sources:          string[];
};

type PerformanceSnapshot = {
  id: string;
  pm_id: string;
  governance_score: number;
  execution_score: number;
  prediction_accuracy_score: number;
  decision_effectiveness_score: number;
  portfolio_health_score: number;
  overall_score: number;
  performance_status: string;
  generated_at: string;
  snapshot_payload: {
    pm_name: string;
    pm_email: string;
    assigned_project_count: number;
    os_snapshot_count: number;
    domain_scores: Record<string, number>;
    capacity_context: CapacityContext;
    performance_risk?: "low" | "medium" | "high" | "critical";
    evidence_confidence?: EvidenceConfidence;
  };
};

const STATUS_STYLES: Record<string, string> = {
  excellent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  strong:    "bg-teal-500/20 text-teal-300 border-teal-500/30",
  stable:    "bg-sky-500/20 text-sky-300 border-sky-500/30",
  warning:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  critical:  "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  excellent: "Excellent",
  strong:    "Strong",
  stable:    "Stable",
  warning:   "Warning",
  critical:  "Critical",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium:   "bg-sky-500/20 text-sky-300 border-sky-500/30",
  low:      "bg-amber-500/20 text-amber-300 border-amber-500/30",
  very_low: "bg-red-500/20 text-red-300 border-red-500/30",
};

const RISK_STYLES: Record<string, string> = {
  low:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const CAPACITY_STATUS_STYLES: Record<string, string> = {
  underutilized: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  healthy:       "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  near_capacity: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  at_capacity:   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  overloaded:    "bg-red-500/20 text-red-300 border-red-500/30",
  busy:          "bg-amber-500/20 text-amber-300 border-amber-500/30",
  critical:      "bg-red-500/20 text-red-300 border-red-500/30",
};

function StatusBadge({ value, styles, labels }: { value: string; styles: Record<string, string>; labels?: Record<string, string> }) {
  const cls = styles[value] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  const label = labels?.[value] ?? value.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string | number; highlight?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function capacityLabel(snap: PerformanceSnapshot): string {
  const cc = snap.snapshot_payload?.capacity_context;
  if (!cc) return "No snapshot";
  const status = cc.assignment_capacity?.assignment_capacity_status ?? cc.capacity_status;
  return status.replace(/_/g, " ");
}

function primaryRecommendation(snap: PerformanceSnapshot): string {
  const status = snap.performance_status;
  const cc = snap.snapshot_payload?.capacity_context;
  const capacityStatus = cc?.assignment_capacity?.assignment_capacity_status ?? cc?.capacity_status ?? "healthy";
  const isOverloaded = capacityStatus === "overloaded" || capacityStatus === "at_capacity" || capacityStatus === "critical";
  const isUnderutilized = capacityStatus === "underutilized";
  const isWeak = status === "warning" || status === "critical";
  const isStrong = status === "excellent" || status === "strong";

  if (isWeak && isOverloaded) return "Rebalance capacity — PM is overloaded and performance is weak.";
  if (isStrong && isOverloaded) return "Protect high performer — PM is excelling under overload. Burnout risk.";
  if (isWeak && isUnderutilized) return "Coach execution — PM has available capacity but weak performance.";
  if (isStrong && isUnderutilized) return "Candidate for additional ownership — strong performance, available capacity.";
  if (status === "excellent") return "Recognize high performance. Consider documenting practices for reuse.";
  if (status === "strong") return "Maintain execution cadence. Performance is healthy.";
  if (status === "stable") return "Monitor execution. Review project signals and pending decisions.";
  if (status === "warning") return "Intervene — review blockers, decision latency and delivery health.";
  return "Executive intervention required. PMO leadership should rebalance support.";
}

export default function PMPerformancePage() {
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pm-performance");
      const json = await res.json() as { ok: boolean; data?: PerformanceSnapshot[]; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to load PM performance snapshots.");
      } else {
        setSnapshots(json.data ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // fetchSnapshots is stable — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchSnapshots(); }, [fetchSnapshots]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/pm-performance/snapshots", { method: "POST" });
      const json = await res.json() as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to generate snapshots.");
      } else {
        await fetchSnapshots();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const excellentCount = snapshots.filter((s) => s.performance_status === "excellent").length;
  const strongCount    = snapshots.filter((s) => s.performance_status === "strong").length;
  const stableCount    = snapshots.filter((s) => s.performance_status === "stable").length;
  const warningCount   = snapshots.filter((s) => s.performance_status === "warning").length;
  const criticalCount  = snapshots.filter((s) => s.performance_status === "critical").length;
  const avgScore = snapshots.length > 0
    ? (snapshots.reduce((sum, s) => sum + Number(s.overall_score), 0) / snapshots.length).toFixed(1)
    : "—";

  const alertPMs = snapshots.filter((s) => s.performance_status === "warning" || s.performance_status === "critical");

  return (
    <div className="min-h-screen bg-[#08080c] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">PM Performance</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Execution performance visibility across Project Managers.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchSnapshots}
              disabled={loading}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate snapshots"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* At-risk banner */}
        {alertPMs.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-medium text-red-300">
              {alertPMs.length === 1
                ? `1 PM requires PMO attention.`
                : `${alertPMs.length} PMs require PMO attention.`}
            </p>
            <p className="mt-1 text-xs text-red-400">
              {alertPMs.map((s) => s.snapshot_payload?.pm_name ?? s.pm_id).join(", ")}
            </p>
          </div>
        )}

        {/* Summary cards */}
        {snapshots.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <SummaryCard label="Total PMs" value={snapshots.length} />
            <SummaryCard label="Excellent" value={excellentCount} highlight="text-emerald-300" />
            <SummaryCard label="Strong" value={strongCount} highlight="text-teal-300" />
            <SummaryCard label="Stable" value={stableCount} highlight="text-sky-300" />
            <SummaryCard label="Warning" value={warningCount} highlight="text-amber-300" />
            <SummaryCard label="Critical" value={criticalCount} highlight="text-red-300" />
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-zinc-400">Avg score</p>
              <p className="mt-1 text-2xl font-semibold text-white">{avgScore}</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!loading && snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-20 text-center">
            <p className="text-sm text-zinc-400">No PM performance snapshots have been generated yet.</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate snapshots"}
            </button>
          </div>
        )}

        {/* Performance table */}
        {!loading && snapshots.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Project Manager</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Email</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Assigned</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Overall score</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Risk</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Evidence</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Capacity</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Recommendation</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-400">Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {snapshots.map((s) => {
                  const isAlert = s.performance_status === "warning" || s.performance_status === "critical";
                  const alertCls = s.performance_status === "critical"
                    ? "border-l-2 border-red-500/80"
                    : s.performance_status === "warning"
                    ? "border-l-2 border-amber-500/60"
                    : "";
                  const capStatus = s.snapshot_payload?.capacity_context?.assignment_capacity?.assignment_capacity_status
                    ?? s.snapshot_payload?.capacity_context?.capacity_status
                    ?? null;

                  return (
                    <tr key={s.id} className={`hover:bg-white/5 ${alertCls}`}>
                      <td className="px-4 py-3 font-medium text-white">
                        <Link href={`/pm-registry/${s.pm_id}`} className="hover:underline">
                          {s.snapshot_payload?.pm_name ?? s.pm_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{s.snapshot_payload?.pm_email ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-300">{s.snapshot_payload?.assigned_project_count ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isAlert ? "text-red-300" : "text-white"}`}>
                          {Number(s.overall_score).toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={s.performance_status} styles={STATUS_STYLES} labels={STATUS_LABELS} />
                      </td>
                      <td className="px-4 py-3">
                        {s.snapshot_payload?.performance_risk ? (
                          <StatusBadge value={s.snapshot_payload.performance_risk} styles={RISK_STYLES} />
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.snapshot_payload?.evidence_confidence ? (
                          <span
                            title={`${s.snapshot_payload.evidence_confidence.available_source_count}/${s.snapshot_payload.evidence_confidence.total_source_count} sources · ${s.snapshot_payload.evidence_confidence.score_interpretation.replace(/_/g, " ")}`}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[s.snapshot_payload.evidence_confidence.confidence_level] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"}`}
                          >
                            {s.snapshot_payload.evidence_confidence.confidence_level.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {capStatus ? (
                          <StatusBadge value={capStatus} styles={CAPACITY_STATUS_STYLES} />
                        ) : (
                          <span className="text-xs text-zinc-500">No snapshot</span>
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-zinc-400 leading-relaxed">
                        {primaryRecommendation(s)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        <span title={new Date(s.generated_at).toLocaleString()}>
                          {timeAgo(s.generated_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
