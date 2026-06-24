"use client";

import { useState, useEffect, useCallback } from "react";

type PM = {
  id: string;
  display_name: string;
  email: string;
  status: string;
};

type Assignment = {
  id: string;
  pm_id: string;
  pm_display_name: string | null;
  pm_email: string | null;
  assignment_type: string;
  assigned_at: string;
  removed_at: string | null;
};

const ASSIGNMENT_TYPE_COLORS: Record<string, string> = {
  primary: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  secondary: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  program: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  observer: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
};

function AssignPMModal({
  projectId,
  onClose,
  onAssigned,
}: {
  projectId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [pms, setPMs] = useState<PM[]>([]);
  const [pmId, setPmId] = useState("");
  const [assignmentType, setAssignmentType] = useState("primary");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPMs, setLoadingPMs] = useState(true);

  useEffect(() => {
    fetch("/api/pm-registry?status=active")
      .then((r) => r.json())
      .then((json: { ok: boolean; data?: PM[] }) => {
        if (json.ok) setPMs(json.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingPMs(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pm-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pmId, assignmentType }),
      });
      const json = await res.json() as { ok: boolean; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to assign PM.");
      } else {
        onAssigned();
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
        <h2 className="text-lg font-semibold text-white">Assign Project Manager</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Project Manager</label>
            {loadingPMs ? (
              <p className="text-xs text-zinc-500">Loading PMs…</p>
            ) : (
              <select
                required
                value={pmId}
                onChange={(e) => setPmId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">Select a PM…</option>
                {pms.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.display_name} ({pm.email})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Assignment Type</label>
            <select
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0c0c10] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="primary">primary</option>
              <option value="secondary">secondary</option>
              <option value="program">program</option>
              <option value="observer">observer</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={loading || !pmId} className="flex-1 rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20 disabled:opacity-50">
              {loading ? "Assigning…" : "Assign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type Props = { projectId: string };

export function ProjectPMAssignment({ projectId }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pm-assignments`);
      const json = await res.json() as { ok: boolean; data?: Assignment[] };
      if (json.ok) setAssignments(json.data ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // fetchAssignments is stable for the lifetime of projectId — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchAssignments(); }, [fetchAssignments]);

  async function handleUnassign(assignmentId: string) {
    const res = await fetch(`/api/projects/${projectId}/pm-assignments/${assignmentId}`, { method: "DELETE" });
    const json = await res.json() as { ok: boolean };
    if (json.ok) void fetchAssignments();
  }

  const byType: Record<string, Assignment[]> = {};
  for (const a of assignments) {
    if (!byType[a.assignment_type]) byType[a.assignment_type] = [];
    byType[a.assignment_type].push(a);
  }

  return (
    <>
      {showAssign && (
        <AssignPMModal
          projectId={projectId}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { setShowAssign(false); void fetchAssignments(); }}
        />
      )}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Project Ownership</h2>
          <button
            onClick={() => setShowAssign(true)}
            className="rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/20"
          >
            Assign PM
          </button>
        </div>

        {loading && <p className="text-xs text-zinc-500">Loading assignments…</p>}

        {!loading && assignments.length === 0 && (
          <p className="text-sm text-zinc-400">No PMs assigned to this project.</p>
        )}

        {!loading && assignments.length > 0 && (
          <div className="space-y-2">
            {(["primary", "secondary", "program", "observer"] as const).map((type) => {
              const group = byType[type];
              if (!group?.length) return null;
              return (
                <div key={type}>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">{type}</p>
                  <ul className="space-y-1">
                    {group.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ASSIGNMENT_TYPE_COLORS[a.assignment_type] ?? ""}`}>
                            {a.assignment_type}
                          </span>
                          <span className="text-sm font-medium text-white">{a.pm_display_name ?? a.pm_id.slice(0, 8) + "…"}</span>
                          {a.pm_email && <span className="text-xs text-zinc-400">{a.pm_email}</span>}
                          <span className="text-xs text-zinc-500">{new Date(a.assigned_at).toLocaleDateString()}</span>
                        </div>
                        <button
                          onClick={() => void handleUnassign(a.id)}
                          className="text-xs text-red-400 hover:text-red-200"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
