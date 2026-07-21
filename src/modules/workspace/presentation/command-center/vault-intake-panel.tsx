"use client";

import { useState } from "react";
import { postOperationalFlow, postVaultIntake } from "./operational-data";
import { CloseIcon } from "./icons";

export function VaultIntakePanel({
  workspaceId,
  projectId,
  onClose,
  onIntakeComplete,
}: {
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onIntakeComplete: (summary: string) => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!content.trim()) {
      setError("Paste some notes before analyzing.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const vaultResult = await postVaultIntake({ workspaceId, projectId, rawContent: content });

      try {
        const created = await postOperationalFlow(workspaceId, projectId, {
          operation: "create_evidence",
          sourceType: "manual_note",
          title: content.slice(0, 80),
          content,
          confidenceLevel: "medium",
        });
        await postOperationalFlow(workspaceId, projectId, { operation: "run_chain", evidenceItemId: created.evidence.id });
      } catch {
        // Vault intake succeeded even if the operational-flow rule chain didn't produce a match — that's fine.
      }

      const { risks, issues, dependencies, assumptions } = vaultResult.raidSnapshot;
      const parts = [
        risks ? `${risks} risk${risks === 1 ? "" : "s"}` : null,
        issues ? `${issues} issue${issues === 1 ? "" : "s"}` : null,
        dependencies ? `${dependencies} dependenc${dependencies === 1 ? "y" : "ies"}` : null,
        assumptions ? `${assumptions} assumption${assumptions === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      const summary = parts.length
        ? `Notes added. I found ${parts.join(", ")}.`
        : "Notes added. Nothing new to flag from this update.";

      onIntakeComplete(summary);
      setContent("");
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't process those notes. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Add project notes</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Paste meeting notes, an email, or an update. I&apos;ll look for risks, commitments, and decisions.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="The supplier confirmed delivery will slip to next Friday. Maria will follow up..."
        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
      />
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !content.trim()}
          className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Analyzing..." : "Analyze notes"}
        </button>
      </div>
    </div>
  );
}
