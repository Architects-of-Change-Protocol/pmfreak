"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveTeamInvites, type PmoTeamInviteInput } from "@/lib/pmo/save-team-invites";
import {
  PMO_ROLES_ORDERED,
  PMO_ROLE_META,
  PMO_DOMAIN_FOCUS_OPTIONS,
  PMO_DOMAIN_FOCUS_META,
  type PmoTeamRole,
  type PmoDomainFocus,
} from "@/lib/pmo/team-roles";

// ─── Styles ───────────────────────────────────────────────────────────────────

const input =
  "block w-full rounded-xl border border-white/[0.12] bg-black/40 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60";

// ─── Types ────────────────────────────────────────────────────────────────────

type InviteRow = {
  id: string;
  email: string;
  role: PmoTeamRole;
  domainFocus: PmoDomainFocus[];
  domainPickerOpen: boolean;
};

function makeRow(): InviteRow {
  return {
    id: Math.random().toString(36).slice(2),
    email: "",
    role: "PROJECT_MANAGER",
    domainFocus: [],
    domainPickerOpen: false,
  };
}

// ─── Domain Focus Picker ──────────────────────────────────────────────────────

function DomainFocusPicker({
  selected,
  onChange,
}: {
  selected: PmoDomainFocus[];
  onChange: (v: PmoDomainFocus[]) => void;
}) {
  return (
    <div className="mt-2 rounded-xl border border-white/[0.08] bg-black/30 p-3">
      <p className="mb-2 text-[9px] uppercase tracking-[0.2em] text-zinc-600">
        Domain Focus — select all that apply
      </p>
      <div className="flex flex-wrap gap-1.5">
        {PMO_DOMAIN_FOCUS_OPTIONS.map((d) => {
          const active = selected.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                onChange(
                  active ? selected.filter((x) => x !== d) : [...selected, d]
                );
              }}
              className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                active
                  ? "border-indigo-400/40 bg-indigo-400/10 text-indigo-200"
                  : "border-white/[0.07] text-zinc-600 hover:border-white/[0.15] hover:text-zinc-400"
              }`}
            >
              {PMO_DOMAIN_FOCUS_META[d].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Invite Row ───────────────────────────────────────────────────────────────

function InviteRowUI({
  row,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  row: InviteRow;
  index: number;
  onUpdate: (patch: Partial<InviteRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const roleMeta = PMO_ROLE_META[row.role];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-4 transition hover:border-white/[0.12]">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Email */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-zinc-600">
                Email {index === 0 && <span className="text-pink-400 normal-case">*</span>}
              </label>
              <input
                type="email"
                className={input}
                placeholder="colleague@company.com"
                value={row.email}
                onChange={(e) => onUpdate({ email: e.target.value })}
              />
            </div>

            {/* Role */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.15em] text-zinc-600">
                Role
              </label>
              <select
                value={row.role}
                onChange={(e) => onUpdate({ role: e.target.value as PmoTeamRole })}
                className={`${input} [&>option]:bg-slate-950`}
              >
                {PMO_ROLES_ORDERED.map((r) => (
                  <option key={r} value={r}>
                    {PMO_ROLE_META[r].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role description */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-700">
            {roleMeta.description}
          </p>

          {/* Domain focus toggle */}
          <button
            type="button"
            onClick={() => onUpdate({ domainPickerOpen: !row.domainPickerOpen })}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600 transition hover:text-zinc-400"
          >
            <span
              className={`inline-block transition-transform ${row.domainPickerOpen ? "rotate-90" : ""}`}
            >
              ›
            </span>
            {row.domainFocus.length > 0
              ? `${row.domainFocus.length} domain focus${row.domainFocus.length > 1 ? "es" : ""} selected`
              : "Add domain focus (optional)"}
          </button>

          {row.domainPickerOpen && (
            <DomainFocusPicker
              selected={row.domainFocus}
              onChange={(v) => onUpdate({ domainFocus: v })}
            />
          )}
        </div>

        {/* Remove */}
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove invite"
            className="mt-0.5 shrink-0 rounded-lg border border-white/[0.06] p-1.5 text-zinc-700 transition hover:border-red-400/30 hover:text-red-400"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InviteTeamClient({ pmoName }: { pmoName: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<InviteRow[]>([makeRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const updateRow = useCallback((id: string, patch: Partial<InviteRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, makeRow()]);
  };

  const handleSendInvites = async () => {
    setSubmitting(true);
    setResult(null);

    const payload: PmoTeamInviteInput[] = rows
      .filter((r) => r.email.trim())
      .map((r) => ({
        email: r.email.trim(),
        role: r.role,
        domainFocus: r.domainFocus,
      }));

    if (payload.length === 0) {
      setResult({ ok: false, message: "Add at least one email address to send invites." });
      setSubmitting(false);
      return;
    }

    const res = await saveTeamInvites(payload);
    setSubmitting(false);

    if (res.ok) {
      setResult({
        ok: true,
        message:
          res.savedCount > 0
            ? `${res.savedCount} invite${res.savedCount > 1 ? "s" : ""} saved. Email delivery can be enabled from settings.`
            : "No valid invites to send.",
      });
      setTimeout(
        () => router.push(`/command-center?from=onboarding&invited=${res.savedCount ?? 0}`),
        res.savedCount > 0 ? 1600 : 400
      );
    } else {
      setResult({ ok: false, message: res.error });
    }
  };

  return (
    <div className="space-y-6">
      {/* PMO context banner */}
      <div className="flex items-center gap-3 rounded-xl border border-cyan-300/10 bg-cyan-400/[0.03] px-4 py-3">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
        <p className="text-xs text-zinc-500">
          <span className="text-cyan-300">{pmoName}</span> brain is online. Assembling the human operating layer.
        </p>
      </div>

      {/* Invite rows */}
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <InviteRowUI
            key={row.id}
            row={row}
            index={idx}
            onUpdate={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
            canRemove={rows.length > 1}
          />
        ))}
      </div>

      {/* Add row */}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.01] px-4 py-2.5 text-sm text-zinc-600 transition hover:border-white/[0.14] hover:text-zinc-300"
      >
        <span className="text-base leading-none">+</span> Add another person
      </button>

      {/* Feedback */}
      {result && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            result.ok
              ? "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-200"
              : "border-red-400/25 bg-red-400/[0.05] text-red-300"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Primary */}
        <button
          type="button"
          onClick={handleSendInvites}
          disabled={submitting}
          className="relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-cyan-950/60 via-indigo-950/60 to-cyan-950/60 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_40px_rgba(34,211,238,0.10)] transition-all hover:shadow-[0_0_60px_rgba(34,211,238,0.18)] disabled:opacity-60"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2.5">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
              Saving invites…
            </span>
          ) : (
            "Send Invites →"
          )}
        </button>

        {/* Secondary + Tertiary */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/command-center?from=onboarding&invited=0")}
            className="rounded-xl border border-white/[0.09] px-4 py-2.5 text-sm text-zinc-500 transition hover:border-white/[0.18] hover:text-zinc-200"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => router.push("/command-center?from=onboarding&invited=0")}
            className="rounded-xl border border-indigo-300/20 bg-indigo-400/[0.06] px-4 py-2.5 text-sm text-indigo-300 transition hover:bg-indigo-400/[0.12]"
          >
            Continue to Command Center
          </button>
        </div>
      </div>

      {/* Role legend */}
      <details className="group rounded-xl border border-white/[0.05] bg-black/20">
        <summary className="cursor-pointer px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-zinc-700 transition hover:text-zinc-500 list-none flex items-center gap-2">
          <span className="transition-transform group-open:rotate-90">›</span>
          Role reference guide
        </summary>
        <div className="border-t border-white/[0.05] px-4 py-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PMO_ROLES_ORDERED.map((r) => {
              const meta = PMO_ROLE_META[r];
              return (
                <div key={r} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/[0.04] text-[9px] font-bold text-zinc-600">
                    {meta.authorityLevel}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-zinc-400">{meta.label}</p>
                    <p className="text-[11px] leading-relaxed text-zinc-700">{meta.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
