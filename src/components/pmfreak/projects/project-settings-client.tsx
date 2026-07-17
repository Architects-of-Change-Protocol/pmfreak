"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PmoOption = { id: string; name: string; icon: string | null };

type ProjectSettings = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  methodology: string | null;
  icon: string | null;
  color: string | null;
  pmo_id: string | null;
};

const METHODOLOGY_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "predictive", label: "Predictive (waterfall)" },
  { value: "agile", label: "Agile" },
  { value: "hybrid", label: "Hybrid" },
  { value: "kanban", label: "Kanban" },
  { value: "other", label: "Other" },
] as const;

const STATUS_OPTIONS = ["active", "completed", "archived"] as const;
const ICON_OPTIONS = ["📌", "🚀", "🏗️", "💼", "🔧", "📊", "🧩", "🛰️"] as const;
const COLOR_OPTIONS = ["#22d3ee", "#818cf8", "#34d399", "#fbbf24", "#f472b6", "#f87171", "#a3e635", "#94a3b8"] as const;

export function ProjectSettingsClient({ project, pmos }: { project: ProjectSettings; pmos: PmoOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    methodology: project.methodology ?? "",
    icon: project.icon ?? "",
    color: project.color ?? "",
    pmoId: project.pmo_id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Only send pmoId when the user actually changed it via the dropdown.
      // The dropdown only lists active PMOs, so a project currently sitting
      // in an archived PMO keeps form.pmoId at that archived id with no
      // matching <option> selected; resending it unconditionally would
      // resubmit that unchanged, untouched value on every save and trip the
      // server's archived-PMO rejection for edits unrelated to the PMO field.
      const pmoChanged = form.pmoId !== (project.pmo_id ?? "");
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          status: form.status,
          methodology: form.methodology || null,
          icon: form.icon || null,
          color: form.color || null,
          ...(pmoChanged ? { pmoId: form.pmoId || null } : {}),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Unable to save project.");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save project.");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/duplicate`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { project?: { id: string }; error?: string };
      if (!res.ok || !data.project) throw new Error(data.error ?? "Unable to duplicate project.");
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to duplicate project.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete project "${project.name}" and all of its data? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Unable to delete project.");
      }
      router.push("/projects");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete project.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      {saved ? <p className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-800">Project updated.</p> : null}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Project details</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900"
            />
          </label>
          <label className="space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
            PMO
            <select
              value={form.pmoId}
              onChange={(e) => setForm((s) => ({ ...s, pmoId: e.target.value }))}
              className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="">Unassigned</option>
              {pmos.map((pmo) => (
                <option key={pmo.id} value={pmo.id}>{pmo.icon ? `${pmo.icon} ` : ""}{pmo.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
            Status
            <select
              value={form.status}
              onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
              className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
            Methodology
            <select
              value={form.methodology}
              onChange={(e) => setForm((s) => ({ ...s, methodology: e.target.value }))}
              className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900"
            >
              {METHODOLOGY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1.5 text-xs uppercase tracking-[0.14em] text-zinc-600">
          Description
          <textarea
            value={form.description}
            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            rows={3}
            className="block w-full rounded-xl border border-slate-200 bg-[#FCFBF9]/75 px-3 py-2.5 text-sm text-slate-900"
          />
        </label>
        <div className="flex flex-wrap items-center gap-6">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, icon: "" }))}
                className={`rounded-lg border px-2 py-1 text-xs ${!form.icon ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-900" : "border-slate-200 text-slate-600 hover:border-slate-200"}`}
              >
                None
              </button>
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, icon }))}
                  className={`rounded-lg border px-2 py-1 text-base ${form.icon === icon ? "border-cyan-300/60 bg-cyan-400/10" : "border-slate-200 bg-white hover:border-slate-200"}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">Color</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, color: "" }))}
                className={`rounded-lg border px-2 py-1 text-xs ${!form.color ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-900" : "border-slate-200 text-slate-600 hover:border-slate-200"}`}
              >
                None
              </button>
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Color ${color}`}
                  onClick={() => setForm((s) => ({ ...s, color }))}
                  className={`h-7 w-7 rounded-full border-2 ${form.color === color ? "border-slate-200" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-xl border border-cyan-200/45 bg-cyan-400/[0.1] px-4 py-2.5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.16] disabled:opacity-50"
        >
          Save changes
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Danger zone</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void duplicate()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-800 hover:border-cyan-300/40 disabled:opacity-50"
          >
            Duplicate project
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="rounded-xl border border-rose-300/25 px-4 py-2 text-sm text-rose-800 hover:border-rose-300/50 disabled:opacity-50"
          >
            Delete project
          </button>
        </div>
        <p className="text-xs text-slate-500">Duplicating copies the project shell (PMO, methodology, look) but not its history — each project keeps its own isolated context.</p>
      </section>
    </div>
  );
}
