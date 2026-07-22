"use client";

import { useState } from "react";
import { Modal } from "@/components/pmfreak/ui/modal";
import { postOperationalFlow } from "@/modules/workspace/presentation/command-center/operational-data";

type CaptureMode = "paste" | "note";

const COPY: Record<CaptureMode, { title: string; placeholder: string; cta: string }> = {
  paste: {
    title: "Capture operational context",
    placeholder: "Paste an email thread, a meeting recap, or any text evidence relevant to this project…",
    cta: "Teach the Project Brain",
  },
  note: {
    title: "Take a note",
    placeholder: "The supplier confirmed delivery will slip to next Friday. Maria will follow up…",
    cta: "Teach the Project Brain",
  },
};

export function TextCaptureModal({
  mode,
  workspaceId,
  projectId,
  onClose,
  onCaptured,
}: {
  mode: CaptureMode;
  workspaceId: string;
  projectId: string;
  onClose: () => void;
  onCaptured: (title: string) => void;
}) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const copy = COPY[mode];

  const submit = async () => {
    if (!content.trim()) {
      setError("Add some content before feeding the Project Brain.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await postOperationalFlow(workspaceId, projectId, {
        operation: "create_evidence",
        sourceType: "manual_note",
        title: content.slice(0, 80),
        content,
        confidenceLevel: "medium",
      });
      try {
        await postOperationalFlow(workspaceId, projectId, { operation: "run_chain", evidenceItemId: created.evidence.id });
      } catch {
        // Evidence capture succeeded even if the rule chain found no match yet.
      }
      onCaptured(content.slice(0, 80) || copy.title);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't capture that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={copy.title} onClose={onClose}>
      <p className="text-xs text-slate-400">
        This becomes part of your project&apos;s operational memory — searchable, connected, and available to your
        project&apos;s AI agents.
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={7}
        placeholder={copy.placeholder}
        autoFocus
        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100"
      />
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !content.trim()}
          className="rounded-lg border border-cyan-200 bg-cyan-50/80 px-3.5 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Learning…" : copy.cta}
        </button>
      </div>
    </Modal>
  );
}
