"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { DecisionStatus, OperationalSummary } from "@/lib/operational-flow/types";

type AnyRecord = Record<string, unknown>;
type AuthorityView = { allowed?: boolean; authorityRequired?: string; authorityBasis?: string | null; reason?: string };

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to load operational flow.");
  return payload as OperationalSummary;
};
const label = (value: unknown) => String(value ?? "").replaceAll("_", " ");
const tone = (value: unknown) => {
  const text = String(value);
  if (["critical", "violation", "decision_required"].includes(text)) return "border-rose-300/30 bg-rose-300/[0.08] text-rose-100";
  if (["high", "warning", "proposed"].includes(text)) return "border-amber-300/30 bg-amber-300/[0.08] text-amber-100";
  return "border-cyan-300/25 bg-cyan-300/[0.06] text-cyan-100";
};

export function OperationalDecisionLoop({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const endpoint = `/api/operational-flow?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`;
  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher, { refreshInterval: 30000, revalidateOnFocus: true });
  const [sourceType, setSourceType] = useState("email");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [manualDecision, setManualDecision] = useState("");
  const [manualRationale, setManualRationale] = useState("");
  const [manualEvidenceId, setManualEvidenceId] = useState("");

  const post = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/operational-flow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, projectId, ...payload }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Operational action failed.");
    return result;
  };

  const addEvidence = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setFailure(""); setNotice("Recording evidence…");
    try {
      const created = await post({ operation: "create_evidence", sourceType, title, content, sourceReference, confidenceLevel: "high" });
      setNotice("Evidence recorded. Applying the system/deterministic rule set…");
      const chain = await post({ operation: "run_chain", evidenceItemId: created.evidence.id });
      setTitle(""); setContent(""); setSourceReference("");
      setNotice(chain.chain.length ? `Recorded ${chain.chain.length} deterministic rule match(es). Governance checks and recommendations are ready.` : "Evidence recorded. No deterministic rule matched; no risk was invented.");
      await mutate();
    } catch (caught) { setFailure(caught instanceof Error ? caught.message : "Unable to process evidence."); setNotice(""); }
    finally { setBusy(false); }
  };

  const recordManualDecision = async (event: React.FormEvent) => {
    event.preventDefault(); const evidenceItemId = manualEvidenceId || String(data?.evidence[0]?.id ?? "");
    if (!evidenceItemId) { setFailure("Add project evidence before recording a manual decision."); return; }
    setBusy(true); setFailure("");
    try {
      await post({ operation: "record_decision", decisionStatus: "accepted", decision: manualDecision, rationale: manualRationale, manualEvidenceItemId: evidenceItemId });
      setManualDecision(""); setManualRationale(""); setManualEvidenceId(""); setNotice("Decision recorded. Evidence snapshot linked and frozen."); await mutate();
    } catch (caught) { setFailure(caught instanceof Error ? caught.message : "Unable to record manual decision."); }
    finally { setBusy(false); }
  };

  const decide = async (recommendation: AnyRecord, decisionStatus: DecisionStatus) => {
    setBusy(true); setFailure("");
    const rationale = rationales[String(recommendation.id)] || `Human review recorded as: ${label(decisionStatus)}.`;
    try {
      await post({ operation: "record_decision", recommendationId: recommendation.id, decisionStatus,
        decision: decisionStatus === "modified" ? `Modification rationale: ${rationale}` : `Recommendation ${label(decisionStatus)} by an authorized human reviewer.`, rationale });
      setNotice("Decision recorded atomically. Recommendation transitioned and evidence snapshot linked."); await mutate();
    } catch (caught) { setFailure(caught instanceof Error ? caught.message : "Unable to record decision."); }
    finally { setBusy(false); }
  };

  const chainRows = useMemo(() => (data?.signals ?? []).map((signal) => {
    const evidence = data?.evidence.find((item) => item.id === signal.evidence_item_id);
    const risk = data?.risksIssues.find((item) => item.signal_id === signal.id);
    const governance = data?.governanceEvents.find((item) => item.related_entity_id === risk?.id);
    const recommendation = data?.recommendations.find((item) => item.governance_event_id === governance?.id);
    const recommendationDecisions = data?.decisions.filter((item) => item.recommendation_id === recommendation?.id) ?? [];
    const decision = recommendationDecisions[0];
    const terminalDecision = recommendationDecisions.find((item) => ["accepted", "rejected", "modified"].includes(String(item.decision_status)));
    const evidenceLink = data?.evidenceLinks.find((item) => item.decision_record_id === decision?.id);
    return { evidence, signal, risk, governance, recommendation, decision, terminalDecision, evidenceLink };
  }), [data]);
  const signalEvidenceIds = new Set((data?.signals ?? []).map((signal) => signal.evidence_item_id));

  return (
    <section className="space-y-4 rounded-2xl border border-indigo-300/20 bg-indigo-300/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10px] uppercase tracking-[0.28em] text-indigo-300">Evidence-backed operating loop</p><h2 className="text-lg font-semibold text-slate-100">Evidence → Signal → Risk / Issue → Governance → Recommendation → Decision</h2><p className="mt-1 max-w-3xl text-xs text-slate-400">PMFreak applies deterministic operational governance rules aligned with AOC concepts. Final authority is checked against PMFreak workspace roles v1.</p></div>
        <span className="rounded-full border border-slate-300/20 bg-slate-950/40 px-3 py-1 text-[10px] text-slate-300">Rule engine: system/deterministic v1 · not AI or an autonomous agent</span>
      </div>

      {data?.actor.canCreateEvidence ? <form onSubmit={addEvidence} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-4 md:grid-cols-2">
        <div className="md:col-span-2"><p className="text-sm font-semibold text-slate-100">Add project evidence</p><p className="text-xs text-slate-500">Evidence is persisted before transactional rule materialization. Confidence is a fixed rule-match score, not model confidence.</p></div>
        <label className="text-xs text-slate-300">Source type<select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100"><option value="email">Email</option><option value="manual_note">Manual note</option><option value="meeting_minutes">Meeting minutes</option><option value="ticket">Ticket</option><option value="conversation">Conversation</option><option value="document_reference">Document reference</option></select></label>
        <label className="text-xs text-slate-300">Title<input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100" placeholder="Client scope request" /></label>
        <label className="text-xs text-slate-300 md:col-span-2">Content<textarea required rows={4} value={content} onChange={(e) => setContent(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100" placeholder="Paste the email, note, minute, ticket or conversation here…" /></label>
        <label className="text-xs text-slate-300">Source reference<input value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100" placeholder="Email thread, ticket URL, document ID" /></label>
        <div className="flex items-end"><button disabled={busy} className="w-full rounded-lg border border-indigo-300/40 bg-indigo-300/[0.12] px-4 py-2 text-sm font-semibold text-indigo-100 disabled:opacity-50">{busy ? "Processing…" : "Add and analyze evidence"}</button></div>
      </form> : <p className="rounded-lg border border-white/10 bg-slate-950/30 p-3 text-xs text-slate-400">Read-only role: evidence intake and human decisions are unavailable.</p>}

      <div className="rounded-xl border border-white/10 bg-slate-950/25 p-3"><p className="text-sm font-semibold text-slate-100">Latest project evidence</p><div className="mt-2 grid gap-2 md:grid-cols-2">{(data?.evidence ?? []).map((item) => <article key={String(item.id)} className="rounded-lg border border-white/10 bg-white/[0.02] p-3"><div className="flex justify-between gap-2"><p className="text-sm text-slate-100">{String(item.title)}</p><span className="text-[10px] text-slate-500">v{String(item.version)}</span></div><p className="mt-1 text-[11px] text-slate-400">{label(item.source_type)} · {String(item.source_reference ?? "No source reference")}</p><p className="mt-1 text-[11px] text-slate-500">{label(item.confidence_level)} rule input confidence · {label(item.status)} · {item.frozen_at ? "frozen" : "editable"}</p><p className="mt-1 font-mono text-[9px] text-slate-600">sha256 {String(item.evidence_hash).slice(0, 16)}…</p>{!signalEvidenceIds.has(item.id) && <p className="mt-2 text-xs text-cyan-200">Recorded; no deterministic signal matched.</p>}</article>)}</div></div>

      {data?.actor.canCreateEvidence && <details className="rounded-xl border border-white/10 bg-slate-950/25 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Record evidence-backed manual decision</summary><form onSubmit={recordManualDecision} className="mt-3 grid gap-2 md:grid-cols-2"><input required value={manualDecision} onChange={(e) => setManualDecision(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100" placeholder="Decision made by the authorized project role" /><select required value={manualEvidenceId || String(data?.evidence[0]?.id ?? "")} onChange={(e) => setManualEvidenceId(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100"><option value="">Select supporting evidence</option>{(data?.evidence ?? []).map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.title)}</option>)}</select><textarea required rows={2} value={manualRationale} onChange={(e) => setManualRationale(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-slate-100 md:col-span-2" placeholder="Decision rationale" /><button disabled={busy || !(data?.evidence.length)} className="rounded-lg border border-cyan-300/35 bg-cyan-300/[0.08] px-4 py-2 text-xs font-semibold text-cyan-100 md:col-span-2 disabled:opacity-50">Record decision with evidence snapshot</button></form></details>}

      {notice && <p className="rounded-lg border border-emerald-300/25 bg-emerald-300/[0.06] px-3 py-2 text-xs text-emerald-100">{notice}</p>}{failure && <p className="rounded-lg border border-rose-300/25 bg-rose-300/[0.06] px-3 py-2 text-xs text-rose-100">{failure}</p>}{error && <p className="text-xs text-rose-200">{error.message}</p>}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{data && Object.entries({ "Governance events": data.assurance.totalGovernanceEvents, "Human decision required": data.assurance.decisionRequiredCount, Violations: data.assurance.violationsCount, "Open recommendations": data.assurance.openRecommendations, "Unresolved risks/issues": data.assurance.unresolvedRisksIssues, "Evidence-linked decisions": data.assurance.evidenceLinkedDecisionsCount }).map(([name, value]) => <div key={name} className="rounded-lg border border-white/10 bg-slate-950/30 p-3"><p className="text-xl font-semibold text-slate-100">{value}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{name}</p></div>)}</div>
      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Project Assurance Summary v1 · exact project counts · as of {data?.assurance.asOf ? new Date(data.assurance.asOf).toLocaleString() : "loading"}</p>

      <div className="space-y-3">{isLoading && <p className="text-xs text-slate-400">Loading the evidence-backed chain…</p>}{!isLoading && chainRows.length === 0 && <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-slate-400">No deterministic signal chain exists yet. Recorded evidence remains visible above.</p>}{chainRows.map(({ evidence, signal, risk, governance, recommendation, decision, terminalDecision, evidenceLink }) => {
        const authority = (recommendation?.actor_authority ?? {}) as Record<string, AuthorityView>;
        return <article key={String(signal.id)} className="rounded-xl border border-white/10 bg-slate-950/30 p-3"><div className="grid gap-2 lg:grid-cols-6"><div><p className="text-[10px] uppercase text-slate-500">Evidence</p><p className="mt-1 text-sm text-slate-100">{String(evidence?.title ?? "Unavailable")}</p><p className="text-xs text-slate-500">{String(evidence?.source_reference ?? "No reference")}</p></div><div><p className="text-[10px] uppercase text-slate-500">Detected signal</p><p className="mt-1 text-sm text-slate-100">{label(signal.signal_type)}</p><span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${tone(signal.severity)}`}>{label(signal.severity)}</span><p className="mt-1 text-[10px] text-slate-500">Rule score {String(signal.confidence_score)}%</p></div><div><p className="text-[10px] uppercase text-slate-500">Risk / Issue</p><p className="mt-1 text-sm text-slate-200">{risk ? label(risk.type) : "Not created"}</p><p className="text-xs text-slate-500">{risk ? label(risk.status) : "—"}</p></div><div><p className="text-[10px] uppercase text-slate-500">Governance check</p><p className="mt-1 text-sm text-slate-200">{governance ? label(governance.rule_key) : "Pending"}</p><p className="text-[10px] text-slate-500">Requires {String(governance?.authority_required ?? "—")}</p>{governance && <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${tone(governance.governance_status)}`}>{label(governance.governance_status)}</span>}</div><div><p className="text-[10px] uppercase text-slate-500">Recommended action</p><p className="mt-1 text-sm text-slate-200">{String(recommendation?.recommendation ?? "Pending")}</p><p className="text-xs text-slate-500">{recommendation ? label(recommendation.status) : "—"}</p></div><div><p className="text-[10px] uppercase text-slate-500">Human decision</p><p className="mt-1 text-sm text-slate-200">{decision ? label(decision.decision_status) : "Authorized human decision required"}</p><p className="text-xs text-slate-500">{decision ? `Recorded · snapshot ${String(evidenceLink?.evidence_hash_at_decision ?? "").slice(0, 10)}…` : "Authority checked at decision time"}</p></div></div>
        {recommendation?.status === "proposed" && !terminalDecision && <div className="mt-3 border-t border-white/10 pt-3"><textarea value={rationales[String(recommendation.id)] ?? ""} onChange={(e) => setRationales((current) => ({ ...current, [String(recommendation.id)]: e.target.value }))} rows={2} className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-slate-100" placeholder="Decision or modification rationale…" /><div className="mt-2 flex flex-wrap gap-2">{[["Accept","accepted"],["Reject","rejected"],["Record modification rationale","modified"],["Mark as needing more evidence","needs_more_evidence"],["Record escalation decision","escalated"]].map(([text, status]) => { const evaluation = authority[status]; return evaluation?.allowed ? <button type="button" disabled={busy} key={status} onClick={() => decide(recommendation, status as DecisionStatus)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06] disabled:opacity-50">{text}</button> : null; })}</div>{!Object.values(authority).some((item) => item.allowed) && <p className="mt-2 text-xs text-amber-200">Requires an authorized decision-maker for: {String(governance?.authority_required ?? "this governance event")}.</p>}</div>}</article>;
      })}</div>
    </section>
  );
}
