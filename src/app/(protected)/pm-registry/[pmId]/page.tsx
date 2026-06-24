"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type PM = {
  id: string;
  display_name: string;
  email: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
};

type Profile = {
  role: string;
  experience_level: string;
  capacity_limit: number;
  active_projects_limit: number;
};

type Assignment = {
  id: string;
  project_id: string;
  assignment_type: string;
  assigned_at: string;
  removed_at: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  inactive: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  suspended: "bg-red-500/20 text-red-300 border-red-500/30",
};

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
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20 disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PMDetailPage() {
  const params = useParams<{ pmId: string }>();
  const pmId = params.pmId;

  const [pm, setPM] = useState<PM | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pmRes, profileRes, assignRes] = await Promise.all([
        fetch(`/api/pm-registry/${pmId}`),
        fetch(`/api/pm-registry/${pmId}/profile`),
        fetch(`/api/pm-registry/${pmId}/assignments?includeRemoved=true`),
      ]);
      const pmJson = await pmRes.json() as { ok: boolean; data?: PM; error?: { message: string } };
      if (!pmJson.ok) {
        setError(pmJson.error?.message ?? "PM not found.");
        return;
      }
      setPM(pmJson.data ?? null);

      const profileJson = await profileRes.json() as { ok: boolean; data?: Profile };
      if (profileJson.ok) setProfile(profileJson.data ?? null);

      const assignJson = await assignRes.json() as { ok: boolean; data?: Assignment[] };
      if (assignJson.ok) setAssignments(assignJson.data ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pmId]);

  // fetchData is stable for the lifetime of pmId — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#050507] p-10 text-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (error || !pm) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-10">
        <p className="text-sm text-red-400">{error ?? "PM not found."}</p>
        <Link href="/pm-registry" className="mt-3 block text-xs text-red-300 underline">Back to registry</Link>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.removed_at === null);
  const historicalAssignments = assignments.filter((a) => a.removed_at !== null);

  return (
    <>
      {showEdit && (
        <EditPMModal
          pm={pm}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => { setPM(updated); setShowEdit(false); }}
        />
      )}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
        <div className="relative space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link href="/pm-registry" className="text-xs text-zinc-500 hover:text-zinc-300">← PM Registry</Link>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{pm.display_name}</h1>
              <p className="mt-1 text-sm text-zinc-400">{pm.email}</p>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pm.status] ?? ""}`}>
                  {pm.status}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Edit
            </button>
          </div>

          {profile && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Profile</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Role", value: profile.role },
                  { label: "Experience", value: profile.experience_level },
                  { label: "Capacity", value: `${profile.capacity_limit}%` },
                  { label: "Max Projects", value: String(profile.active_projects_limit) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="mt-1 text-sm font-medium text-white">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Active Assignments ({activeAssignments.length})</h2>
            {activeAssignments.length === 0 ? (
              <p className="text-sm text-zinc-400">No active assignments.</p>
            ) : (
              <ul className="space-y-2">
                {activeAssignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                    <span className="text-zinc-300 font-mono text-xs">{a.project_id}</span>
                    <span className="text-xs text-indigo-300">{a.assignment_type}</span>
                    <span className="text-xs text-zinc-500">{new Date(a.assigned_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {historicalAssignments.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold text-zinc-400 mb-3">Historical Assignments ({historicalAssignments.length})</h2>
              <ul className="space-y-2">
                {historicalAssignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-2 text-sm opacity-60">
                    <span className="text-zinc-400 font-mono text-xs">{a.project_id}</span>
                    <span className="text-xs text-zinc-500">{a.assignment_type}</span>
                    <span className="text-xs text-zinc-500">removed {new Date(a.removed_at!).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
