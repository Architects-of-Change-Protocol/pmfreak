"use client";

import { useState } from "react";
import { Modal } from "@/components/pmfreak/ui/modal";
import type { EvidenceProvenanceResult } from "@/lib/operational-flow/types";
import { postOperationalFlow } from "@/modules/workspace/presentation/command-center/operational-data";

type CaptureMode = "paste" | "note";

const COPY = {
  paste: { title: "Capture operational context", placeholder: "Paste an email thread, meeting recap, or other project context…" },
  note: { title: "Take a note", placeholder: "The supplier said delivery may slip to next Friday…" },
} satisfies Record<CaptureMode, { title: string; placeholder: string }>;

export function TextCaptureModal({ mode, workspaceId, projectId, onClose, onCaptured }: {
  mode: CaptureMode; workspaceId: string; projectId: string; onClose: () => void; onCaptured: (title: string) => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assertionType, setAssertionType] = useState<"INFERENCE" | "ASSUMPTION">("ASSUMPTION");
  const [classification, setClassification] = useState("UNCLASSIFIED");
  const [missingDataState, setMissingDataState] = useState("UNKNOWN");
  const [confidenceScore, setConfidenceScore] = useState("0.50");
  const [result, setResult] = useState<EvidenceProvenanceResult | null>(null);
  const copy = COPY[mode];

  const submit = async () => {
    if (!content.trim()) { setError("Add content before capture."); return; }
    const confidence = Number(confidenceScore);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) { setError("Confidence must be between 0 and 1."); return; }
    setBusy(true); setError("");
    try {
      const requestId = crypto.randomUUID();
      const captured = await postOperationalFlow(workspaceId, projectId, {
        operation: "capture_input", sourceKey: "manual-demo:v1", idempotencyKey: `capture:${requestId}`,
        title: content.slice(0, 80), content, occurredAt: new Date().toISOString(), correlationId: requestId,
      });
      const derived = await postOperationalFlow(workspaceId, projectId, {
        operation: "derive_evidence", normalizedEventId: captured.normalizedEvent.id,
        idempotencyKey: `evidence:${requestId}`, assertionType, classification,
        confidenceScore: confidence, missingDataState, evaluatedAt: new Date().toISOString(),
      }) as EvidenceProvenanceResult;
      setResult(derived);
      onCaptured(content.slice(0, 80) || copy.title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Capture failed. Nothing was reported as successful.");
    } finally { setBusy(false); }
  };

  if (result) return (
    <Modal title="Provenance recorded" onClose={onClose}>
      <div role="status" aria-live="polite" className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 text-xs text-cyan-950">
        <strong>DEMO / FIXTURE</strong> · {result.disposition === "duplicate" ? "Safe duplicate replay" : "Evidence derived"}
      </div>
      <ol aria-label="Source to Evidence provenance chain" className="mt-4 space-y-3 text-xs text-slate-700">
        {[["Source", result.source.id, result.source.status], ["Raw Input", result.rawInput.id, result.rawInput.content_digest], ["Normalized Event", result.normalizedEvent.id, result.normalizedEvent.event_digest], ["Evidence", result.evidence.id, result.evidence.derivation_digest]].map(([label, id, detail]) => (
          <li key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-semibold">{String(label)}</p><p className="mt-1 break-all font-mono text-[10px]">ID: {String(id)}</p><p className="mt-1 break-all font-mono text-[10px]">{String(detail)}</p>
          </li>
        ))}
      </ol>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div><dt className="text-slate-400">Assertion</dt><dd className="font-semibold">{String(result.evidence.assertion_type)}</dd></div>
        <div><dt className="text-slate-400">Classification</dt><dd className="font-semibold">{String(result.evidence.classification)}</dd></div>
        <div><dt className="text-slate-400">Confidence</dt><dd>{String(result.evidence.confidence_score)}</dd></div>
        <div><dt className="text-slate-400">Missing data</dt><dd>{String(result.evidence.missing_data_state)}</dd></div>
        <div><dt className="text-slate-400">Freshness</dt><dd>{String(result.evidence.freshness_state)}</dd></div>
        <div><dt className="text-slate-400">Recorded</dt><dd>{String(result.evidence.recorded_at)}</dd></div>
      </dl>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Intelligence has not run. No Finding, Recommendation, Decision, Action, Task, or Outcome was created.</p>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-xs font-semibold text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">Close</button>
    </Modal>
  );

  return (
    <Modal title={copy.title} onClose={onClose}>
      <p className="text-xs text-slate-500"><strong>DEMO / FIXTURE.</strong> Manual input is not externally verified and is not Evidence until explicitly derived.</p>
      <label className="sr-only" htmlFor="manual-provenance-content">Manual demo input</label>
      <textarea id="manual-provenance-content" value={content} onChange={(event) => setContent(event.target.value)} rows={7} placeholder={copy.placeholder} autoFocus className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">Assertion type<select value={assertionType} onChange={(e) => setAssertionType(e.target.value as "INFERENCE" | "ASSUMPTION")} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"><option value="ASSUMPTION">Assumption</option><option value="INFERENCE">Inference</option></select></label>
        <label className="text-xs text-slate-600">Classification<select value={classification} onChange={(e) => setClassification(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"><option value="UNCLASSIFIED">Unclassified</option><option value="PROJECT_STATUS">Project status</option><option value="RISK">Risk</option><option value="ISSUE">Issue</option><option value="DECISION_CONTEXT">Decision context</option><option value="DELIVERY">Delivery</option></select></label>
        <label className="text-xs text-slate-600">Missing data<select value={missingDataState} onChange={(e) => setMissingDataState(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2"><option value="UNKNOWN">Unknown</option><option value="PARTIAL">Partial</option><option value="COMPLETE">Complete</option></select></label>
        <label className="text-xs text-slate-600">Confidence (0–1)<input type="number" min="0" max="1" step="0.01" value={confidenceScore} onChange={(e) => setConfidenceScore(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600">Cancel</button>
        <button type="button" onClick={submit} disabled={busy || !content.trim()} className="rounded-lg border border-cyan-200 bg-cyan-50/80 px-3.5 py-2 text-xs font-semibold text-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Capturing and deriving…" : "Capture, then derive Evidence"}</button>
      </div>
    </Modal>
  );
}
