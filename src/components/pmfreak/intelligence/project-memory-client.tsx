"use client";


import useSWR from "swr";
import type { AIResponseEnvelope, MemoryEvent } from "@/lib/ai/types";

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load project memory (${response.status})`);
  }
  return response.json() as Promise<T>;
};

export function ProjectMemoryClient({ endpoint }: { endpoint: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<AIResponseEnvelope<MemoryEvent[]>>(endpoint, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10000,
    errorRetryCount: 3,
  });

  const lastRefreshed = data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : null;

  if (isLoading) {
    return <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">Loading project memory…</section>;
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-rose-300/30 bg-rose-950/20 p-5 text-sm text-rose-900">
        <p>Project memory is temporarily unavailable.</p>
        <button onClick={() => void mutate()} className="mt-3 rounded-lg border border-rose-200/40 px-3 py-2 text-xs uppercase tracking-wide text-rose-900 hover:bg-rose-300/10">Retry fetch</button>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="mb-3 text-xs uppercase tracking-wide text-slate-600">Last refreshed: {lastRefreshed}{isValidating ? " · updating…" : ""}</p>
      <ol className="space-y-3">
        {data.data.map((event) => (
          <li key={event.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase text-cyan-700">{event.timestamp.slice(0, 10)} · {event.type} · {event.module}</p>
            <p className="mt-1 text-sm text-slate-700">{event.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
