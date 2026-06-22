"use client";

import { useState, type ChangeEvent } from "react";
import { createRoadmapSource } from "@/lib/program-builder-client";
import type { ProgramRoadmapSourceRow } from "@/lib/program-builder-client";
import type { ProgramRoadmapSourceType } from "@/lib/db/database-contract";

const SOURCE_TYPES: { value: ProgramRoadmapSourceType; label: string }[] = [
  { value: "CLAUDE_PLAN", label: "Claude Plan" },
  { value: "AOC_PLAN",    label: "AOC Plan" },
  { value: "MARKDOWN",    label: "Markdown" },
  { value: "TEXT",        label: "Plain Text" },
  { value: "INFRASTRUCTURE_PLAN", label: "Infrastructure Plan" },
  { value: "CUSTOM",      label: "Custom" },
];

type Props = {
  programId: string;
  onSaved: (source: ProgramRoadmapSourceRow) => void;
};

export function RoadmapSourceEditor({ programId, onSaved }: Props) {
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<ProgramRoadmapSourceType>("CLAUDE_PLAN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ProgramRoadmapSourceRow | null>(null);

  const handleSave = async () => {
    if (!rawText.trim()) { setError("Roadmap text is required."); return; }
    setLoading(true);
    setError(null);
    const result = await createRoadmapSource(programId, {
      rawText: rawText.trim(),
      sourceType,
      title: title.trim() || null,
      status: "ACTIVE",
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setSaved(result.data.roadmapSource);
    onSaved(result.data.roadmapSource);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Source Title <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          value={title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder="Initial Roadmap"
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300/70"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Source Type
        </label>
        <select
          value={sourceType}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setSourceType(e.target.value as ProgramRoadmapSourceType)}
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300/70"
        >
          {SOURCE_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Roadmap Text <span className="text-rose-400">*</span>
        </label>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Paste a structured roadmap with EPIC, Sprint, and Prompt blocks. Program Builder will preserve the source, parse the structure, and generate executable cards.
        </p>
        <textarea
          value={rawText}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRawText(e.target.value)}
          rows={14}
          placeholder={"EPIC 1 — Foundation\n  Sprint 1 — Setup\n  Sprint 2 — Core Model\n  ..."}
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300/70 resize-y"
        />
        <p className="mt-1 text-right text-[11px] text-zinc-600">
          {rawText.length.toLocaleString()} characters
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {saved && (
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-300">Source saved.</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-400">
            <span>Version {saved.version}</span>
            <span className="capitalize">Status: {saved.status}</span>
          </div>
        </div>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={loading || !rawText.trim()}
        className="w-full rounded-xl border border-indigo-300/40 bg-indigo-400/[0.1] px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/[0.18] disabled:opacity-40"
      >
        {loading ? "Saving…" : "Save Roadmap Source"}
      </button>
    </div>
  );
}
