"use client";

import { useState } from "react";
import useSWR from "swr";
import type { OperationalMemoryEntry } from "@/lib/operational-memory-v1";
import { OperationalMemoryTable } from "./operational-memory-table";

const MEMORY_TYPES = [
  "risks",
  "blockers",
  "decisions",
  "stakeholders",
  "action_items",
  "unresolved_questions",
  "dependencies",
  "milestones",
  "escalations",
] as const;
type MemoryType = (typeof MEMORY_TYPES)[number];

const fetcher = async <T,>(url: string): Promise<T> => (await fetch(url)).json() as Promise<T>;

export function OperationalMemoryWorkspace() {
  const [memoryType, setMemoryType] = useState<MemoryType>("risks");
  const [text, setText] = useState("");
  const { data, mutate } = useSWR<{ records: OperationalMemoryEntry[] }>(`/api/operational-memory?memoryType=${memoryType}&unresolvedOnly=true`, fetcher);

  const save = async () => {
    if (!text.trim()) return;
    await fetch("/api/operational-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sourceType: "manual", sourceReference: "operational-memory-ui" }),
    });
    setText("");
    await mutate();
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">{MEMORY_TYPES.map((d) => <button key={d} onClick={() => setMemoryType(d)} className={`rounded-full border px-3 py-1 text-xs ${d === memoryType ? "border-cyan-300/70 bg-cyan-300/15" : "border-slate-200"}`}>{d.replaceAll("_", " ")}</button>)}</div>
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold">Operational memory capture</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste operational updates, risks, decisions, blockers, dependencies, and open questions." className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" />
      <button onClick={() => void save()} className="mt-2 rounded-lg border border-cyan-300/40 px-3 py-2 text-sm">Capture memory</button>
    </section>
    <OperationalMemoryTable records={data?.records ?? []} />
  </div>;
}
