"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type AssignmentCapacityStatus = "underutilized" | "healthy" | "near_capacity" | "at_capacity" | "overloaded";
type AssignmentOverloadRisk = "low" | "medium" | "high" | "critical";

type AssignmentCapacityPayload = {
  active_assignment_count: number;
  counted_assignment_count: number;
  observer_assignment_count: number;
  active_projects_limit: number;
  assignment_capacity_utilization: number;
  assignment_capacity_status: AssignmentCapacityStatus;
  assignment_overload_risk: AssignmentOverloadRisk;
  assignment_breakdown: { primary: number; secondary: number; program: number; observer: number };
  recommendations: Array<{ type: string; severity: string; message: string }>;
};

type CapacitySnapshot = {
  id: string;
  pm_id: string;
  capacity_status: string;
  burn_risk: string;
  utilization_percentage: number;
  recommended_action: string;
  generated_at: string;
  snapshot_payload: {
    pm_name: string;
    pm_email: string;
    active_projects_limit: number;
    assignment_capacity?: AssignmentCapacityPayload;
  };
};

const CAPACITY_STATUS_STYLES: Record<string, string> = {
  underutilized: "bg-sky-500/20 text-sky-700 border-sky-500/30",
  healthy:       "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  near_capacity: "bg-amber-500/20 text-amber-700 border-amber-500/30",
  at_capacity:   "bg-orange-500/20 text-orange-700 border-orange-500/30",
  overloaded:    "bg-red-500/20 text-red-700 border-red-500/30",
  busy:          "bg-amber-500/20 text-amber-700 border-amber-500/30",
  critical:      "bg-red-500/20 text-red-700 border-red-500/30",
};

const RISK_STYLES: Record<string, string> = {
  none:     "bg-zinc-500/20 text-zinc-700 border-zinc-500/30",
  low:      "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
  medium:   "bg-amber-500/20 text-amber-700 border-amber-500/30",
  high:     "bg-orange-500/20 text-orange-700 border-orange-500/30",
  critical: "bg-red-500/20 text-red-700 border-red-500/30",
};

const ALERT_ROW: Record<string, string> = {
  near_capacity: "border-l-2 border-amber-500/60",
  at_capacity:   "border-l-2 border-orange-500/80",
  overloaded:    "border-l-2 border-red-500/80",
};

function StatusBadge({ value, styles }: { value: string; styles: Record<string, string> }) {
  const cls = styles[value] ?? "bg-zinc-500/20 text-zinc-700 border-zinc-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${highlight ?? "text-slate-900"}`}>{value}</p>
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

export default function PMCapacityPage() {
  const [snapshots, setSnapshots] = useState<CapacitySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pm-capacity");
      const json = await res.json() as { ok: boolean; data?: CapacitySnapshot[]; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to load PM capacity snapshots.");
      } else {
        setSnapshots(json.data ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // fetchSnapshots is stable (useCallback with [] deps) — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchSnapshots(); }, [fetchSnapshots]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/pm-capacity/snapshots", { method: "POST" });
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

  // Summary counts (assignment-based status, with fallback)
  const statuses = snapshots.map(
    (s) => s.snapshot_payload?.assignment_capacity?.assignment_capacity_status ?? s.capacity_status
  );
  const underutilizedCount = statuses.filter((s) => s === "underutilized").length;
  const healthyCount       = statuses.filter((s) => s === "healthy").length;
  const nearCapacityCount  = statuses.filter((s) => s === "near_capacity" || s === "busy").length;
  const atCapacityCount    = statuses.filter((s) => s === "at_capacity").length;
  const overloadedCount    = statuses.filter((s) => s === "overloaded" || s === "critical").length;
  const avgUtil = snapshots.length > 0
    ? snapshots.reduce((sum: number, s: CapacitySnapshot) => {
        const u = s.snapshot_payload?.assignment_capacity?.assignment_capacity_utilization;
        return sum + (typeof u === "number" ? u * 100 : s.utilization_percentage);
      }, 0) / snapshots.length
    : 0;

  const alertPMs = snapshots.filter((s) => {
    const st = s.snapshot_payload?.assignment_capacity?.assignment_capacity_status ?? s.capacity_status;
    return st === "at_capacity" || st === "overloaded" || st === "critical";
  });

  return (
    <div className="min-h-screen bg-[#08080c] px-6 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">PM Capacity</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Operational load and capacity visibility across project managers.
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Snapshots regenerate automatically after assignment and profile changes.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchSnapshots}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-zinc-700 hover:bg-white disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-indigo-500 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate snapshots"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Capacity alert banner */}
        {alertPMs.length > 0 && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm font-medium text-red-700">
              {alertPMs.length === 1
                ? `1 PM is at or exceeding configured capacity.`
                : `${alertPMs.length} PMs are at or exceeding configured capacity.`}
            </p>
            <p className="mt-1 text-xs text-red-600">
              {alertPMs.map((s) => s.snapshot_payload?.pm_name ?? s.pm_id).join(", ")}
            </p>
          </div>
        )}

        {/* Summary cards */}
        {snapshots.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <SummaryCard label="Total PMs" value={snapshots.length} />
            <SummaryCard label="Underutilized" value={underutilizedCount} highlight="text-sky-700" />
            <SummaryCard label="Healthy" value={healthyCount} highlight="text-emerald-700" />
            <SummaryCard label="Near capacity" value={nearCapacityCount} highlight="text-amber-700" />
            <SummaryCard label="At capacity" value={atCapacityCount} highlight="text-orange-700" />
            <SummaryCard label="Overloaded" value={overloadedCount} highlight="text-red-700" />
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-zinc-600">Avg utilization</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{avgUtil.toFixed(1)}%</p>
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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center">
            <p className="text-sm text-zinc-600">No PM capacity snapshots have been generated yet.</p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-slate-900 hover:bg-indigo-500 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate snapshots"}
            </button>
          </div>
        )}

        {/* Capacity table */}
        {!loading && snapshots.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-left">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Project Manager</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Email</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Limit</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Counted</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Observer</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Utilization</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Capacity status</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Overload risk</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Recommendation</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-600">Last generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {snapshots.map((s) => {
                  const ac = s.snapshot_payload?.assignment_capacity;
                  const capacityStatus = ac?.assignment_capacity_status ?? s.capacity_status;
                  const overloadRisk   = ac?.assignment_overload_risk ?? s.burn_risk;
                  const utilization    = typeof ac?.assignment_capacity_utilization === "number"
                    ? (ac.assignment_capacity_utilization * 100).toFixed(1) + "%"
                    : s.utilization_percentage.toFixed(1) + "%";
                  const countedCount   = ac?.counted_assignment_count ?? "—";
                  const observerCount  = ac?.observer_assignment_count ?? "—";
                  const limit          = ac?.active_projects_limit ?? s.snapshot_payload?.active_projects_limit ?? "—";
                  const recommendation = ac?.recommendations?.[0]?.message ?? s.recommended_action;
                  const alertCls       = ALERT_ROW[capacityStatus] ?? "";

                  return (
                    <tr key={s.id} className={`hover:bg-white ${alertCls}`}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <Link href={`/pm-registry/${s.pm_id}`} className="hover:underline">
                          {s.snapshot_payload?.pm_name ?? s.pm_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{s.snapshot_payload?.pm_email ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-700">{limit}</td>
                      <td className="px-4 py-3 text-zinc-700">{countedCount}</td>
                      <td className="px-4 py-3 text-zinc-700">{observerCount}</td>
                      <td className="px-4 py-3 text-zinc-700">{utilization}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={capacityStatus} styles={CAPACITY_STATUS_STYLES} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={overloadRisk} styles={RISK_STYLES} />
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-zinc-600 leading-relaxed">{recommendation}</td>
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
