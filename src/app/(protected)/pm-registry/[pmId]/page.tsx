"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type {
  PMOperatingDossier,
  PMDossierCapacityPresent,
  PMDossierPerformancePresent,
  PMDossierEvidencePresent,
} from "@/lib/pm-detail-intelligence";

// ─── Style maps ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  inactive:  "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  suspended: "bg-red-500/20 text-red-300 border-red-500/30",
};

const OPERATIONAL_STATUS_STYLES: Record<string, string> = {
  healthy:               "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  watch:                 "bg-amber-500/20 text-amber-300 border-amber-500/30",
  capacity_risk:         "bg-orange-500/20 text-orange-300 border-orange-500/30",
  performance_risk:      "bg-red-500/20 text-red-300 border-red-500/30",
  insufficient_evidence: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  critical:              "bg-red-500/20 text-red-300 border-red-500/30",
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

const PERF_STATUS_STYLES: Record<string, string> = {
  excellent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  strong:    "bg-teal-500/20 text-teal-300 border-teal-500/30",
  stable:    "bg-sky-500/20 text-sky-300 border-sky-500/30",
  warning:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  critical:  "bg-red-500/20 text-red-300 border-red-500/30",
};

const RISK_STYLES: Record<string, string> = {
  none:     "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  low:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium:   "bg-sky-500/20 text-sky-300 border-sky-500/30",
  low:      "bg-amber-500/20 text-amber-300 border-amber-500/30",
  very_low: "bg-red-500/20 text-red-300 border-red-500/30",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low:      "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
};

// ─── Edit PM Modal ────────────────────────────────────────────────────────────

type PM = { id: string; display_name: string; email: string; status: "active" | "inactive" | "suspended" };

function EditPMModal({ pm, onClose, onUpdated }: { pm: PM; onClose: () => void; onUpdated: (pm: PM) => void }) {
  const [displayName, setDisplayName] = useState(pm.display_name);
  const [status, setStatus] = useState(pm.status);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pm-registry/${pm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, status }),
      });
      const json = await res.json() as { ok: boolean; data?: PM; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to update project manager.");
      } else if (json.data) {
        onUpdated(json.data);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c10] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Edit Project Manager</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Display Name</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PM["status"])}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20 disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-white mb-3">{title}</h2>
      {children}
    </div>
  );
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Badge({ text, style }: { text: string; style?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"}`}>
      {text.replace(/_/g, " ")}
    </span>
  );
}

// ─── Risk / Recommendation Banner ────────────────────────────────────────────

function RiskBanner({ dossier }: { dossier: PMOperatingDossier }) {
  const { operational_status, top_recommendation } = dossier.executive_summary;

  const bannerConfig: Record<string, { border: string; bg: string; text: string; label: string } | undefined> = {
    critical:              { border: "border-red-500/30",    bg: "bg-red-500/10",    text: "text-red-300",    label: "Critical" },
    performance_risk:      { border: "border-red-500/30",    bg: "bg-red-500/10",    text: "text-red-300",    label: "Performance Risk" },
    capacity_risk:         { border: "border-orange-500/30", bg: "bg-orange-500/10", text: "text-orange-300", label: "Workload Warning" },
    insufficient_evidence: { border: "border-zinc-500/30",   bg: "bg-zinc-500/10",   text: "text-zinc-300",   label: "Provisional Score" },
    watch:                 { border: "border-amber-500/30",  bg: "bg-amber-500/10",  text: "text-amber-300",  label: "Watch" },
  };

  const config = bannerConfig[operational_status];
  if (!config || operational_status === "healthy") return null;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} px-4 py-3`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs font-semibold ${config.text} shrink-0`}>[{config.label}]</span>
        <p className={`text-xs ${config.text}`}>
          {top_recommendation ?? "PMO review may be required."}
        </p>
      </div>
    </div>
  );
}

// ─── Executive Summary Cards ──────────────────────────────────────────────────

function ExecutiveSummaryCards({ dossier }: { dossier: PMOperatingDossier }) {
  const s = dossier.executive_summary;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard label="Operational Status">
        <Badge text={s.operational_status} style={OPERATIONAL_STATUS_STYLES[s.operational_status]} />
      </MetricCard>
      <MetricCard label="Active Assignments">
        <p className="text-sm font-medium text-white">{s.active_assignment_count}</p>
        <p className="text-xs text-zinc-500">{s.counted_assignment_count} counted</p>
      </MetricCard>
      <MetricCard label="Capacity">
        {s.capacity_status ? (
          <Badge text={s.capacity_status} style={CAPACITY_STATUS_STYLES[s.capacity_status]} />
        ) : (
          <span className="text-xs text-zinc-500">No snapshot</span>
        )}
      </MetricCard>
      <MetricCard label="Performance">
        {s.performance_status ? (
          <Badge text={s.performance_status} style={PERF_STATUS_STYLES[s.performance_status]} />
        ) : (
          <span className="text-xs text-zinc-500">No snapshot</span>
        )}
      </MetricCard>
      <MetricCard label="Evidence Confidence">
        {s.evidence_confidence_level ? (
          <>
            <Badge text={s.evidence_confidence_level} style={CONFIDENCE_STYLES[s.evidence_confidence_level]} />
            {s.evidence_completeness !== null && (
              <p className="mt-1 text-xs text-zinc-500">{Math.round(s.evidence_completeness * 100)}% complete</p>
            )}
          </>
        ) : (
          <span className="text-xs text-zinc-500">Not available</span>
        )}
      </MetricCard>
    </div>
  );
}

// ─── Capacity Section ─────────────────────────────────────────────────────────

function CapacitySection({ dossier, onGenerate, generating, error }: {
  dossier: PMOperatingDossier;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}) {
  const cap = dossier.capacity;
  const pmId = dossier.pm.pm_id;

  return (
    <Section title="Capacity Intelligence">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          {cap.present && (
            <p className="text-xs text-zinc-500">Last generated: {new Date(cap.generated_at).toLocaleString()}</p>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="shrink-0 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate capacity snapshot"}
        </button>
      </div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {!cap.present ? (
        <p className="text-sm text-zinc-400">{cap.message}</p>
      ) : (() => {
        const c = cap as PMDossierCapacityPresent;
        const isAlert = c.capacity_status === "overloaded" || c.capacity_status === "critical";
        const isWarning = c.capacity_status === "near_capacity" || c.capacity_status === "at_capacity";
        const utilPct = c.capacity_utilization !== null
          ? `${(c.capacity_utilization * 100).toFixed(1)}%`
          : "—";
        return (
          <>
            {isAlert && (
              <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                This PM is {c.capacity_status.replace(/_/g, " ")}. Review assignments before adding new projects.
              </div>
            )}
            {isWarning && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                This PM is approaching capacity. Monitor before adding new workload-counting assignments.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label="Capacity status">
                <Badge text={c.capacity_status} style={CAPACITY_STATUS_STYLES[c.capacity_status]} />
              </MetricCard>
              <MetricCard label="Overload risk">
                <Badge text={c.overload_risk} style={RISK_STYLES[c.overload_risk]} />
              </MetricCard>
              <MetricCard label="Utilization">
                <p className="text-sm font-medium text-white">{utilPct}</p>
              </MetricCard>
              <MetricCard label="Counted / limit">
                <p className="text-sm font-medium text-white">
                  {c.counted_assignment_count ?? "—"} / {c.active_projects_limit ?? "—"}
                </p>
              </MetricCard>
              <MetricCard label="Observer assignments">
                <p className="text-sm font-medium text-white">{c.observer_assignment_count ?? "—"}</p>
              </MetricCard>
              {c.recommendations.length > 0 && (
                <div className="col-span-2 sm:col-span-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-zinc-500 mb-1">Recommendation</p>
                  <p className="text-sm text-zinc-300">{c.recommendations[0]?.message}</p>
                </div>
              )}
            </div>
          </>
        );
      })()}
      <div className="mt-3">
        <Link href={`/pm-capacity/${pmId}`} className="text-xs text-indigo-400 hover:text-indigo-300">
          View full capacity dashboard →
        </Link>
      </div>
    </Section>
  );
}

// ─── Performance Section ──────────────────────────────────────────────────────

function PerformanceSection({ dossier, onGenerate, generating, error }: {
  dossier: PMOperatingDossier;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
}) {
  const perf = dossier.performance;
  const pmId = dossier.pm.pm_id;

  return (
    <Section title="Performance Intelligence">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          {perf.present && (
            <p className="text-xs text-zinc-500">Last generated: {new Date(perf.generated_at).toLocaleString()}</p>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="shrink-0 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate performance snapshot"}
        </button>
      </div>
      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
      {!perf.present ? (
        <p className="text-sm text-zinc-400">{perf.message}</p>
      ) : (() => {
        const p = perf as PMDossierPerformancePresent;
        const isAlert = p.performance_status === "critical" || p.performance_status === "warning";
        const domains = [
          { label: "Governance",  value: p.governance_score },
          { label: "Execution",   value: p.execution_score },
          { label: "Prediction",  value: p.prediction_score },
          { label: "Decisions",   value: p.decision_score },
          { label: "Portfolio",   value: p.portfolio_score },
        ];
        return (
          <>
            {isAlert && (
              <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${p.performance_status === "critical" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>
                PM performance is <strong>{p.performance_status}</strong>. PMO review recommended.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label="Overall score">
                <p className="text-xl font-semibold text-white">{p.overall_performance_score.toFixed(1)}</p>
              </MetricCard>
              <MetricCard label="Status">
                <Badge text={p.performance_status} style={PERF_STATUS_STYLES[p.performance_status]} />
              </MetricCard>
              {p.performance_risk && (
                <MetricCard label="Performance risk">
                  <Badge text={p.performance_risk} style={RISK_STYLES[p.performance_risk]} />
                </MetricCard>
              )}
              {p.assigned_project_count !== null && (
                <MetricCard label="Assigned projects">
                  <p className="text-sm font-medium text-white">{p.assigned_project_count}</p>
                </MetricCard>
              )}
              {domains.map(({ label, value }) => (
                <MetricCard key={label} label={label}>
                  <p className="text-sm font-medium text-white">{value.toFixed(1)}</p>
                </MetricCard>
              ))}
            </div>
          </>
        );
      })()}
      <div className="mt-3">
        <Link href={`/pm-performance/${pmId}`} className="text-xs text-indigo-400 hover:text-indigo-300">
          View full performance dashboard →
        </Link>
      </div>
    </Section>
  );
}

// ─── Evidence Confidence Section ──────────────────────────────────────────────

function EvidenceConfidenceSection({ dossier }: { dossier: PMOperatingDossier }) {
  const ev = dossier.evidence_confidence;

  return (
    <Section title="Evidence Confidence">
      {!ev.present ? (
        <p className="text-sm text-zinc-400">{ev.message}</p>
      ) : (() => {
        const e = ev as PMDossierEvidencePresent;
        return (
          <>
            {e.warning && (
              <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                {e.warning}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Confidence level">
                <Badge text={e.confidence_level} style={CONFIDENCE_STYLES[e.confidence_level]} />
              </MetricCard>
              <MetricCard label="Completeness">
                <p className="text-sm font-medium text-white">{Math.round(e.evidence_completeness * 100)}%</p>
              </MetricCard>
              <MetricCard label="Sources">
                <p className="text-sm font-medium text-white">{e.available_source_count} / {e.total_source_count}</p>
              </MetricCard>
              <MetricCard label="Interpretation">
                <p className="text-xs text-zinc-300">{e.score_interpretation.replace(/_/g, " ")}</p>
              </MetricCard>
            </div>
            {e.missing_sources.length > 0 && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500 mb-1">Missing sources</p>
                <p className="text-xs text-zinc-400">{e.missing_sources.join(", ")}</p>
              </div>
            )}
            {e.neutral_baseline_domains.length > 0 && (
              <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-zinc-500 mb-1">Neutral baseline (75) applied to</p>
                <p className="text-xs text-zinc-400">{e.neutral_baseline_domains.join(", ")}</p>
              </div>
            )}
          </>
        );
      })()}
    </Section>
  );
}

// ─── Project Breakdown Section ────────────────────────────────────────────────

function ProjectBreakdownSection({ dossier }: { dossier: PMOperatingDossier }) {
  const rows = dossier.project_breakdown;
  if (rows.length === 0) {
    return (
      <Section title="Project Breakdown">
        <p className="text-sm text-zinc-400">No assignments found.</p>
      </Section>
    );
  }

  return (
    <Section title="Project Breakdown">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-zinc-400">
          <thead>
            <tr className="text-left border-b border-white/10">
              {["Project", "Type", "Status", "Counted", "Evidence", "Active", "Assigned"].map((h) => (
                <th key={h} className="pb-2 pr-4 font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={`${r.project_id}-${r.assignment_type}-${r.assigned_at}`}>
                <td className="py-2 pr-4 font-mono text-xs">{r.project_id.slice(0, 8)}…</td>
                <td className="py-2 pr-4">
                  <Badge text={r.assignment_type} />
                </td>
                <td className="py-2 pr-4 text-zinc-400">{r.project_status ?? "—"}</td>
                <td className="py-2 pr-4">
                  {r.capacity_counted
                    ? <span className="text-emerald-400">Yes</span>
                    : <span className="text-zinc-500">No</span>}
                </td>
                <td className="py-2 pr-4 text-zinc-500">{r.evidence_status.replace(/_/g, " ")}</td>
                <td className="py-2 pr-4">
                  {r.active
                    ? <span className="text-emerald-400">Active</span>
                    : <span className="text-zinc-500">Removed</span>}
                </td>
                <td className="py-2 pr-4">{new Date(r.assigned_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── Assignments Section ──────────────────────────────────────────────────────

function AssignmentsSection({ dossier }: { dossier: PMOperatingDossier }) {
  const { active, historical } = dossier.assignments;
  return (
    <div className="space-y-4">
      <Section title={`Active Assignments (${active.length})`}>
        {active.length === 0 ? (
          <p className="text-sm text-zinc-400">No active assignments.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((a) => (
              <li key={a.assignment_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                <span className="text-zinc-300 font-mono text-xs">{a.project_id}</span>
                <Badge text={a.assignment_type} />
                <span className="text-xs text-zinc-500">{new Date(a.assigned_at).toLocaleDateString()}</span>
                {a.capacity_counted && <span className="text-xs text-emerald-500">counted</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {historical.length > 0 && (
        <Section title={`Historical Assignments (${historical.length})`} className="opacity-70">
          <ul className="space-y-2">
            {historical.map((a) => (
              <li key={a.assignment_id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-2 text-sm opacity-70">
                <span className="text-zinc-400 font-mono text-xs">{a.project_id}</span>
                <span className="text-xs text-zinc-500">{a.assignment_type}</span>
                {a.removed_at && (
                  <span className="text-xs text-zinc-500">removed {new Date(a.removed_at).toLocaleDateString()}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ─── Recommendations Section ──────────────────────────────────────────────────

function RecommendationsSection({ dossier }: { dossier: PMOperatingDossier }) {
  const recs = dossier.recommendations;
  return (
    <Section title="Recommendations">
      <ul className="space-y-2">
        {recs.map((r, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <Badge text={r.severity} style={SEVERITY_STYLES[r.severity]} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-zinc-300">{r.message}</p>
              <p className="mt-0.5 text-xs text-zinc-600">{r.source.replace(/_/g, " ")} · {r.type.replace(/_/g, " ")}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ─── Event Timeline Section ───────────────────────────────────────────────────

function EventTimelineSection({ dossier }: { dossier: PMOperatingDossier }) {
  const events = dossier.event_timeline;
  return (
    <Section title="Event Timeline">
      {events.length === 0 ? (
        <p className="text-sm text-zinc-400">No recent PM events found.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((e, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400/60" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300">{e.summary}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-600">
                  <span>{e.event_type}</span>
                  <span>·</span>
                  <span>{new Date(e.occurred_at).toLocaleString()}</span>
                  {e.actor_user_id && <><span>·</span><span className="font-mono">{e.actor_user_id.slice(0, 8)}</span></>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────

function ProfileSection({ dossier }: { dossier: PMOperatingDossier }) {
  const { profile } = dossier;
  if (!profile.present) {
    return (
      <Section title="PM Profile">
        <p className="text-sm text-zinc-400">{profile.message}</p>
      </Section>
    );
  }
  return (
    <Section title="PM Profile">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Role", value: profile.role },
          { label: "Experience", value: profile.experience_level },
          { label: "Capacity", value: `${profile.capacity_limit}%` },
          { label: "Max Projects", value: String(profile.active_projects_limit) },
        ].map(({ label, value }) => (
          <MetricCard key={label} label={label}>
            <p className="text-sm font-medium text-white">{value}</p>
          </MetricCard>
        ))}
      </div>
    </Section>
  );
}

// ─── Actions Section ──────────────────────────────────────────────────────────

function ActionsSection({ dossier, onGenerateCapacity, onGeneratePerformance, generatingCapacity, generatingPerformance }: {
  dossier: PMOperatingDossier;
  onGenerateCapacity: () => void;
  onGeneratePerformance: () => void;
  generatingCapacity: boolean;
  generatingPerformance: boolean;
}) {
  return (
    <Section title="Actions">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onGenerateCapacity}
          disabled={generatingCapacity}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {generatingCapacity ? "Generating…" : "Generate Capacity Snapshot"}
        </button>
        <button
          onClick={onGeneratePerformance}
          disabled={generatingPerformance}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-50"
        >
          {generatingPerformance ? "Generating…" : "Generate Performance Snapshot"}
        </button>
        <Link
          href={`/pm-capacity`}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
        >
          View PM Capacity
        </Link>
        <Link
          href={`/pm-performance`}
          className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
        >
          View PM Performance
        </Link>
      </div>
    </Section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PMDetailPage() {
  const params = useParams<{ pmId: string }>();
  const pmId = params.pmId;

  const [dossier, setDossier] = useState<PMOperatingDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [generatingCapacity, setGeneratingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [generatingPerformance, setGeneratingPerformance] = useState(false);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  const fetchDossier = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pm-registry/${pmId}/intelligence`);
      const json = await res.json() as { ok: boolean; data?: PMOperatingDossier; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "PM not found.");
        return;
      }
      setDossier(json.data ?? null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pmId]);

  // fetchDossier is stable for the lifetime of pmId — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchDossier(); }, [fetchDossier]);

  async function generateCapacity() {
    setGeneratingCapacity(true);
    setCapacityError(null);
    try {
      const res = await fetch(`/api/pm-capacity/${pmId}/snapshot`, { method: "POST" });
      const json = await res.json() as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setCapacityError(json.error?.message ?? "Failed to generate capacity snapshot.");
      } else {
        await fetchDossier();
      }
    } catch {
      setCapacityError("Network error. Please try again.");
    } finally {
      setGeneratingCapacity(false);
    }
  }

  async function generatePerformance() {
    setGeneratingPerformance(true);
    setPerformanceError(null);
    try {
      const res = await fetch(`/api/pm-performance/${pmId}/snapshot`, { method: "POST" });
      const json = await res.json() as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setPerformanceError(json.error?.message ?? "Failed to generate performance snapshot.");
      } else {
        await fetchDossier();
      }
    } catch {
      setPerformanceError("Network error. Please try again.");
    } finally {
      setGeneratingPerformance(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#050507] p-10 text-center">
        <p className="text-sm text-zinc-400">Loading PM Operating Dossier…</p>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-10">
        <p className="text-sm text-red-400">{error ?? "PM not found."}</p>
        <Link href="/pm-registry" className="mt-3 block text-xs text-red-300 underline">Back to registry</Link>
      </div>
    );
  }

  const { pm, executive_summary } = dossier;

  return (
    <>
      {showEdit && (
        <EditPMModal
          pm={{ id: pm.pm_id, display_name: pm.display_name, email: pm.email, status: pm.status as PM["status"] }}
          onClose={() => setShowEdit(false)}
          onUpdated={() => { setShowEdit(false); void fetchDossier(); }}
        />
      )}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
        <div className="relative space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/pm-registry" className="text-xs text-zinc-500 hover:text-zinc-300">← PM Registry</Link>
              <p className="mt-1 text-xs font-medium text-indigo-400 tracking-widest uppercase">PM Operating Dossier</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">{pm.display_name}</h1>
              <p className="mt-1 text-sm text-zinc-400">{pm.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge text={pm.status} style={STATUS_COLORS[pm.status]} />
                {executive_summary.role && <Badge text={executive_summary.role} />}
                {executive_summary.experience_level && (
                  <Badge text={executive_summary.experience_level} />
                )}
              </div>
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Edit
            </button>
          </div>

          {/* Executive Summary Cards */}
          <ExecutiveSummaryCards dossier={dossier} />

          {/* Risk / Recommendation Banner */}
          <RiskBanner dossier={dossier} />

          {/* Profile */}
          <ProfileSection dossier={dossier} />

          {/* Capacity */}
          <CapacitySection
            dossier={dossier}
            onGenerate={generateCapacity}
            generating={generatingCapacity}
            error={capacityError}
          />

          {/* Performance */}
          <PerformanceSection
            dossier={dossier}
            onGenerate={generatePerformance}
            generating={generatingPerformance}
            error={performanceError}
          />

          {/* Evidence Confidence */}
          <EvidenceConfidenceSection dossier={dossier} />

          {/* Project Breakdown */}
          <ProjectBreakdownSection dossier={dossier} />

          {/* Assignments */}
          <AssignmentsSection dossier={dossier} />

          {/* Recommendations */}
          <RecommendationsSection dossier={dossier} />

          {/* Event Timeline */}
          <EventTimelineSection dossier={dossier} />

          {/* Actions */}
          <ActionsSection
            dossier={dossier}
            onGenerateCapacity={generateCapacity}
            onGeneratePerformance={generatePerformance}
            generatingCapacity={generatingCapacity}
            generatingPerformance={generatingPerformance}
          />

        </div>
      </section>
    </>
  );
}
