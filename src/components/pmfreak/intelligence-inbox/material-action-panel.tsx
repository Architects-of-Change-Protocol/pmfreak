"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Summary = { decisions: Row[]; evidenceLinks: Row[]; materialActions: Row[]; materialActionEvaluations: Row[] };

const short = (value: unknown) => String(value ?? "").slice(0, 12);
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : [];

export function MaterialActionPanel({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [decisionId, setDecisionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/operational-flow?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load governed actions.");
    const data = await response.json() as Summary;
    setSummary(data);
    setDecisionId((current) => current || String(data.decisions.find((row) => ["accepted", "modified"].includes(String(row.decision_status)))?.id ?? ""));
  }, [workspaceId, projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh().catch((error: Error) => setMessage(error.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const evaluations = useMemo(() => new Map([...(summary?.materialActionEvaluations ?? [])].reverse().map((row) => [String(row.action_id), row])), [summary]);

  async function propose(profile: "authorized" | "denied" | "degraded") {
    if (!decisionId) return setMessage("Select an eligible Decision first.");
    setBusy(true); setMessage("");
    const evaluationTime = new Date(); const expiresAt = new Date(evaluationTime.getTime() + 60 * 60 * 1000);
    const actionClass = profile === "denied" ? "knowledge_elevation" : "external_write";
    const risk = profile === "degraded" ? "unknown" : "high";
    const body = { operation: "propose_material_action", workspaceId, projectId, decisionId,
      idempotencyKey: `${decisionId}:${profile}:p2-06-v1`, actionClass, actionType: profile === "denied" ? "prohibited_knowledge_elevation" : "schedule_change_proposal",
      targetResourceType: "project_schedule", targetResourceId: projectId, intendedOperation: "propose_only",
      intendedEffect: `Demonstrate ${profile} in-process governance without execution.`, risk,
      reversibility: profile === "degraded" ? "unknown" : "partially_reversible", sideEffect: "external",
      justification: "P2-06 governed Decision-to-Action demonstration.", createdAt: evaluationTime.toISOString(), evaluationTime: evaluationTime.toISOString(), expiresAt: expiresAt.toISOString() };
    try {
      const response = await fetch("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(String(data.error ?? "Governance request failed."));
      setMessage(`${profile} governance persisted. Authorized does not mean Executed.`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Governance request failed."); }
    finally { setBusy(false); }
  }

  async function revoke(actionId: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/operational-flow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "revoke_material_action", workspaceId, projectId, actionId, evaluationTime: new Date().toISOString(), reasonCode: "local_governance_revoked" }) });
      if (!response.ok) throw new Error("Revocation failed.");
      setMessage("Authorization revoked. The original proposal and evaluation remain immutable."); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Revocation failed."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="material-action-heading" className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-600">AOC-E in-process</p><h2 id="material-action-heading" className="mt-1 text-lg font-semibold text-zinc-900">Decision to Material Action</h2></div>
      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Governed and inert</span>
    </div>
    <p className="mt-2 text-sm text-zinc-600">Authorization does not mean execution. No Task was created. No action was dispatched. No Outcome or Observation was created. Remote AOC writeback is not enabled.</p>
    <label htmlFor="material-action-decision" className="mt-4 block text-sm font-medium text-zinc-800">Eligible source Decision</label>
    <select id="material-action-decision" value={decisionId} onChange={(event) => setDecisionId(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
      <option value="">Select a Decision</option>{(summary?.decisions ?? []).filter((row) => ["accepted", "modified"].includes(String(row.decision_status))).map((row) => <option key={String(row.id)} value={String(row.id)}>{short(row.id)} · {String(row.decision_status)}</option>)}
    </select>
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Governance scenarios">
      <button disabled={busy} onClick={() => void propose("authorized")} className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Request authorized action</button>
      <button disabled={busy} onClick={() => void propose("denied")} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50">Request prohibited action</button>
      <button disabled={busy} onClick={() => void propose("degraded")} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">Request degraded evaluation</button>
      <button disabled={busy} onClick={() => void refresh()} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 disabled:opacity-50">Refresh persisted state</button>
    </div>
    <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-zinc-700">{busy ? "Evaluating governance…" : message}</p>
    <div className="mt-4 space-y-3">
      {(summary?.materialActions ?? []).map((action) => { const evaluation = evaluations.get(String(action.id)) ?? {}; const proposal = action.proposal as Row ?? {}; return <article key={String(action.id)} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-zinc-900">Material Action <span title={String(action.id)}>{short(action.id)}</span></h3><span className="font-mono text-xs font-semibold uppercase text-violet-800">{String(evaluation.governance_state ?? "proposed")}</span></div>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div><dt className="font-semibold">Contract / D5 class</dt><dd>{String(action.schema_version)} · {String(action.action_class)}</dd></div>
          <div><dt className="font-semibold">Materiality</dt><dd>{String(action.materiality)}</dd></div>
          <div><dt className="font-semibold">Decision / Evidence</dt><dd title={String(action.source_decision_id)}>{short(action.source_decision_id)} · {list(proposal.evidenceReferenceIds).map(short).join(", ")}</dd></div>
          <div><dt className="font-semibold">Evaluation time</dt><dd>{String(evaluation.evaluated_at ?? "")}</dd></div>
          <div><dt className="font-semibold">Policy / grants</dt><dd>{String(evaluation.policy_decision_reference ?? "none")} · {list(evaluation.grant_references).join(", ") || "none"}</dd></div>
          <div><dt className="font-semibold">Obligations / approvals</dt><dd>{list(evaluation.obligation_references).join(", ") || "none"} · {list(evaluation.approval_references).join(", ") || "none"}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold">SHA-256 proposal digest</dt><dd className="break-all font-mono" title={String(action.proposal_digest)}>{String(action.proposal_digest)}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold">Correlation / causation</dt><dd>{String(action.correlation_id)} · {String(action.causation_id ?? "none")}</dd></div>
        </dl>
        {evaluation.governance_state === "authorized" && <button disabled={busy} onClick={() => void revoke(String(action.id))} className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-800 disabled:opacity-50">Revoke authorization</button>}
      </article>; })}
      {summary && summary.materialActions.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">No Material Actions yet. Select an eligible Decision to request one.</p>}
    </div>
  </section>;
}
