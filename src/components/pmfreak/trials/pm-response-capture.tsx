"use client";

import { useState } from "react";
import type { TrialScenario } from "@/lib/trials/trial-model";

type Props = { scenario: TrialScenario; onSubmit: (response: string, submittedAt: number) => void };

export function PMResponseCapture({ scenario, onSubmit }: Props) {
  const [response, setResponse] = useState("");
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Step 1-2: Review and submit PM response</h3>
      <p className="text-sm text-slate-700">{scenario.prompt}</p>
      <textarea value={response} onChange={(e) => setResponse(e.target.value)} className="min-h-32 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-900" placeholder="Write your PM reasoning before reveal..." />
      <button type="button" onClick={() => onSubmit(response, Date.now())} disabled={!response.trim()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">Submit PM response</button>
    </section>
  );
}
