"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { createProgram } from "@/lib/program-builder-client";
import { PROGRAM_TYPES } from "@/lib/programs/types";
import type { ProgramType } from "@/lib/db/database-contract";

const TYPE_LABELS: Record<ProgramType, string> = {
  SOFTWARE_DEVELOPMENT:   "Software Development",
  INFRASTRUCTURE_PROJECT: "Infrastructure Project",
  CUSTOMER_ONBOARDING:    "Customer Onboarding",
  AOC_PROTOCOL_ADOPTION:  "AOC Protocol Adoption",
  ORGANIZATIONAL_CHANGE:  "Organizational Change",
  STRATEGIC_INITIATIVE:   "Strategic Initiative",
  INTERNAL_PROGRAM:       "Internal Program",
  CUSTOM:                 "Custom",
};

export function ProgramCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ProgramType>("SOFTWARE_DEVELOPMENT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setLoading(true);
    setError(null);
    const result = await createProgram({ name: name.trim(), description: description.trim() || null, type });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push(`/programs/${result.data.program.id}/builder`);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Program Name <span className="text-rose-400">*</span>
        </label>
        <input
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          required
          placeholder="Q3 Platform Migration"
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300/70"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe the program scope and purpose…"
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300/70 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
          Program Type <span className="text-rose-400">*</span>
        </label>
        <select
          value={type}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value as ProgramType)}
          className="mt-1.5 block w-full rounded-xl border border-white/15 bg-slate-950/75 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300/70"
        >
          {PROGRAM_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl border border-indigo-300/40 bg-indigo-400/[0.1] px-4 py-2.5 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/[0.18] disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Program"}
      </button>
    </form>
  );
}
