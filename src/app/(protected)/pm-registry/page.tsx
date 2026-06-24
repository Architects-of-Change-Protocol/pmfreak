"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type PM = {
  id: string;
  display_name: string;
  email: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  inactive: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  suspended: "bg-red-500/20 text-red-300 border-red-500/30",
};

function CreatePMModal({ onClose, onCreated }: { onClose: () => void; onCreated: (pm: PM) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/pm-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const json = await res.json() as { ok: boolean; data?: PM; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to create project manager.");
      } else if (json.data) {
        onCreated(json.data);
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
        <h2 className="text-lg font-semibold text-white">Register Project Manager</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Display Name</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ana Lima"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana@example.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create PM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PMRegistryPage() {
  const [pms, setPMs] = useState<PM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPMs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pm-registry");
      const json = await res.json() as { ok: boolean; data?: PM[]; error?: { message: string } };
      if (!json.ok) {
        setError(json.error?.message ?? "Failed to load project managers.");
      } else {
        setPMs(json.data ?? []);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // fetchPMs is stable (useCallback with [] deps) — calling it here is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchPMs(); }, [fetchPMs]);

  function handleCreated(pm: PM) {
    setPMs((prev) => [...prev, pm].sort((a, b) => a.display_name.localeCompare(b.display_name)));
    setShowCreate(false);
  }

  return (
    <>
      {showCreate && (
        <CreatePMModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#050507] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:38px_38px]" />
        <div className="pointer-events-none absolute -left-24 top-14 h-80 w-80 rounded-full bg-indigo-500/15 blur-[140px]" />

        <div className="relative space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/45 p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_38%,rgba(99,102,241,0.14),transparent_45%),radial-gradient(circle_at_78%_62%,rgba(34,211,238,0.10),transparent_44%)]" />
            <div className="relative max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-indigo-200">PM Registry</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">Project Manager Registry</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
                Project Managers are governable project ownership entities. Register, manage, and assign PMs to projects with full audit evidence.
              </p>
            </div>
          </header>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">All Project Managers</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Registry</h2>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-xl border border-indigo-300/40 bg-indigo-400/[0.1] px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/[0.18]"
            >
              Register PM
            </button>
          </div>

          {loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-sm text-zinc-400">Loading project managers…</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={fetchPMs} className="mt-2 text-xs text-red-300 underline">Retry</button>
            </div>
          )}

          {!loading && !error && pms.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <p className="text-sm text-zinc-400">No project managers registered yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 rounded-xl border border-indigo-300/40 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20"
              >
                Register your first PM
              </button>
            </div>
          )}

          {!loading && !error && pms.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left">
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Name</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Email</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Status</th>
                    <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Registered</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pms.map((pm, i) => (
                    <tr
                      key={pm.id}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"}`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{pm.display_name}</td>
                      <td className="px-4 py-3 text-zinc-300">{pm.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pm.status] ?? ""}`}>
                          {pm.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{new Date(pm.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/pm-registry/${pm.id}`}
                          className="text-xs text-indigo-300 hover:text-indigo-100"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
