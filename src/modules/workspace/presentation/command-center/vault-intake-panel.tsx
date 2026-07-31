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
      const actionsCreated = vaultResult.recommendedActionsCreated ?? 0;
      const summary = parts.length
        ? `Notes added. I found ${parts.join(", ")}.${actionsCreated > 0 ? " Suggested next steps are waiting for your decision in Needs You." : ""}`
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_2px_20px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Add project notes</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Paste meeting notes, an email, or an update. I&apos;ll look for risks, commitments, and decisions.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-zinc-500 hover:bg-white/5">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        placeholder="The supplier confirmed delivery will slip to next Friday. Maria will follow up..."
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/10"
      />
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !content.trim()}
          className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Analyzing..." : "Analyze notes"}
        </button>
      </div>
    </div>
  );
}
