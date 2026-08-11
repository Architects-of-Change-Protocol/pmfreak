"use client";

import { useState } from "react";
import { captureAndDeriveDemoEvidence } from "./operational-data";
import { CloseIcon } from "./icons";

export function VaultIntakePanel({ workspaceId, projectId, onClose, onIntakeComplete }: {
  workspaceId: string; projectId: string; onClose: () => void; onIntakeComplete: (summary: string) => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!content.trim()) { setError("Paste some notes before capture."); return; }
    setBusy(true); setError("");
    try {
      await captureAndDeriveDemoEvidence(workspaceId, projectId, { title: content.slice(0, 80), content });
      onIntakeComplete("DEMO / FIXTURE Evidence derived with complete provenance. Intelligence has not run.");
      setContent(""); onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not capture those notes. Nothing was reported as successful.");
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_2px_20px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-semibold text-zinc-100">Add project notes</p><p className="mt-0.5 text-xs text-zinc-500">DEMO / FIXTURE manual input. Capture and Evidence derivation remain separate; intelligence will not run.</p></div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-zinc-500 hover:bg-white/5"><CloseIcon className="h-4 w-4" /></button>
      </div>
      <label className="sr-only" htmlFor="vault-demo-input">Manual demo project notes</label>
      <textarea id="vault-demo-input" value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="The supplier said delivery may slip to next Friday…" className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/10" />
      {error && <p role="alert" className="mt-2 text-xs text-rose-400">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5">Cancel</button>
        <button type="button" onClick={submit} disabled={busy || !content.trim()} className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Capturing and deriving…" : "Capture and derive Evidence"}</button>
      </div>
    </div>
  );
}
