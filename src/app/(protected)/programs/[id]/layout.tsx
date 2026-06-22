"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getProgram } from "@/lib/program-builder-client";
import type { ProgramRow } from "@/lib/program-builder-client";
import { ProgramShell } from "@/components/program-builder/ProgramShell";
import { ProgramErrorState } from "@/components/program-builder/ProgramErrorState";

export default function ProgramLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [programId, setProgramId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setProgramId(p.id));
  }, [params]);

  useEffect(() => {
    if (!programId) return;
    let active = true;
    async function load() {
      const result = await getProgram(programId!);
      if (!active) return;
      if (!result.ok) { setError(result.error); } else { setProgram(result.data.program); }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [programId]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.01]" />
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/[0.01]" />
      </div>
    );
  }

  if (error || !program) {
    return <ProgramErrorState message={error ?? "Program not found."} />;
  }

  return <ProgramShell program={program}>{children}</ProgramShell>;
}
