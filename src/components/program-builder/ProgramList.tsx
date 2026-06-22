"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listPrograms } from "@/lib/program-builder-client";
import type { ProgramRow } from "@/lib/program-builder-client";
import { ProgramStatusBadge } from "./ProgramStatusBadge";
import { ProgramTypeBadge } from "./ProgramTypeBadge";
import { ProgramEmptyState } from "./ProgramEmptyState";
import { ProgramErrorState } from "./ProgramErrorState";

export function ProgramList() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await listPrograms();
      if (!active) return;
      if (!result.ok) { setError(result.error); } else { setPrograms(result.data.programs); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (error) return <ProgramErrorState message={error} />;
  if (programs.length === 0) return <ProgramEmptyState />;

  return (
    <div className="space-y-3">
      {programs.map((program: ProgramRow) => (
        <div key={program.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">{program.name}</h3>
                <ProgramStatusBadge status={program.status} />
                <ProgramTypeBadge type={program.type} />
              </div>
              {program.description && (
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{program.description}</p>
              )}
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-zinc-600">
                Created {new Date(program.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={`/programs/${program.id}/builder`}
                className="rounded-lg border border-indigo-300/30 bg-indigo-400/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-400/20"
              >
                Open Builder
              </Link>
              <Link
                href={`/programs/${program.id}/board`}
                className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
              >
                Open Board
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
