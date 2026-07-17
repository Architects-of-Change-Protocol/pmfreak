"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/pmfreak/module-shell";
import type { InputHubMode } from "@/lib/operational-classifier";

type ModeCard = { mode: InputHubMode; title: string; prompt: string; placeholder: string };
const CARDS: ModeCard[] = [
  { mode: "quick_update", title: "Quick Operational Update", prompt: "What got riskier today?", placeholder: "What changed today? What feels risky or blocked?" },
  { mode: "stakeholder_signal", title: "Stakeholder Signal", prompt: "Who is starting to lose confidence?", placeholder: "Stakeholder name, behavior, escalation concern, alignment shift..." },
  { mode: "meeting_intelligence", title: "Meeting Intelligence", prompt: "What decision is still unresolved?", placeholder: "Summary, tensions, decisions, unresolved items, follow-up risk..." },
  { mode: "delivery_signal", title: "Delivery Signal", prompt: "Where is coordination breaking down?", placeholder: "Blockers, milestone risk, dependencies, confidence changes..." },
  { mode: "governance_concern", title: "Governance Concern", prompt: "What feels politically sensitive?", placeholder: "Missing approvals, unclear ownership, reporting or escalation gaps..." },
  { mode: "team_health_signal", title: "Team Health Signal", prompt: "What are people avoiding talking about?", placeholder: "Overload, PM fatigue, burnout indicators, communication breakdown..." },
  { mode: "attachment", title: "Screenshot / Document Upload", prompt: "Attach source evidence with context", placeholder: "Add context note so PMFreak can route this evidence." },
];

export default function InputHubPage() {
  const [active, setActive] = useState<ModeCard>(CARDS[0]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; title: string; domain: string; confidenceScore: number; createdAt: string; extractedFacts: string[] }>>([]);
  const [understood, setUnderstood] = useState<string[]>([]);

  useEffect(() => { void fetch("/api/input-hub").then((r) => r.json()).then((d) => setHistory(d.records ?? [])); }, []);

  async function submit() {
    const payload = {
      mode: active.mode,
      title: title || active.title,
      text,
      contextNote,
      fileName: file?.name,
      mimeType: file?.type,
    };
    const res = await fetch("/api/input-hub", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) return;
    setUnderstood(data.result?.affectedSummary ?? []);
    const historyRes = await fetch("/api/input-hub");
    const historyData = await historyRes.json();
    setHistory(historyData.records ?? []);
    setText("");
    setContextNote("");
    setFile(null);
  }

  return (
    <ModuleShell title="Operational Input Hub" subtitle="Drop operational reality here. PMFreak classifies, routes, structures, and persists each signal into operational memory." metrics={[{ label: "Modes", value: "7" }, { label: "Routing", value: "Live" }, { label: "Traceability", value: "On" }, { label: "Daily Loop", value: "Active" }]}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => <button key={card.mode} onClick={() => setActive(card)} className={`rounded-2xl border p-4 text-left ${active.mode === card.mode ? "border-cyan-300 bg-cyan-500/10" : "border-slate-200 bg-white"}`}><p className="text-sm font-semibold">{card.title}</p><p className="mt-1 text-xs text-slate-700">{card.prompt}</p></button>)}
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">{active.title}</h2>
        <p className="text-sm text-slate-700">{active.prompt}</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Signal title" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={active.placeholder} className="min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" />
        {active.mode === "attachment" ? <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" /> : null}
        <input value={contextNote} onChange={(e) => setContextNote(e.target.value)} placeholder="Context note (optional)" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" />
        <button onClick={submit} className="rounded-xl bg-cyan-400 px-4 py-2 text-black font-semibold">Submit Operational Signal</button>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold">PMFreak understood this as</h3>
        <ul className="mt-2 list-disc pl-6 text-sm text-slate-800">{understood.map((u) => <li key={u}>{u}</li>)}</ul>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold">Recent Operational Signals</h3>
        <div className="mt-3 space-y-2">
          {history.map((row) => <article key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-medium">{row.title}</p><p className="text-slate-600">Routed: {row.domain} · Confidence: {row.confidenceScore}% · {new Date(row.createdAt).toLocaleString()}</p><p className="text-slate-700">Generated: {(row.extractedFacts ?? []).slice(0, 2).join(", ") || "Signals generated"}</p></article>)}
        </div>
      </section>
    </ModuleShell>
  );
}
