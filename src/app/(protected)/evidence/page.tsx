"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type EvidenceStatus = "uploaded" | "processing" | "processed" | "failed";

type EvidenceItem = {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  uploaded_at: string;
  status: EvidenceStatus;
  extraction?: EvidenceContentItem;
};

type EvidenceContentItem = {
  id: string;
  evidence_id: string;
  content_hash: string;
  word_count: number;
  processing_duration_ms: number;
};

type EvidenceListResponse = { evidence?: EvidenceItem[]; error?: string };
type EvidenceContentResponse = { content?: EvidenceContentItem[]; error?: string };
type UploadResponse = { ok: true; uploadedCount: number; projectName: string } | { ok: false; error: string };

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.xlsx,.pptx,.txt";

const statusTone: Record<EvidenceStatus, string> = {
  uploaded: "border-slate-400/30 bg-slate-400/10 text-slate-100",
  processing: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  processed: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  failed: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

const formatUploadDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatDuration = (milliseconds: number) => {
  if (!Number.isFinite(milliseconds)) return "—";
  return `${(milliseconds / 1000).toFixed(1)} seconds`;
};

const formatHash = (hash?: string) => hash ? `${hash.slice(0, 8)}...` : "—";

export default function ProjectEvidencePage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() ?? "";
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadHref = useMemo(() => (projectId ? `/upload?projectId=${projectId}` : "/upload"), [projectId]);

  const loadEvidence = useCallback(async () => {
    if (!projectId) {
      setEvidence([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [evidenceResponse, contentResponse] = await Promise.all([
        fetch(`/api/project-evidence?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
        fetch(`/api/project-evidence-content?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" }),
      ]);
      const payload = (await evidenceResponse.json()) as EvidenceListResponse;
      const contentPayload = (await contentResponse.json()) as EvidenceContentResponse;
      if (!evidenceResponse.ok) {
        throw new Error(payload.error ?? "Unable to load project evidence.");
      }
      if (!contentResponse.ok) {
        throw new Error(contentPayload.error ?? "Unable to load project evidence content.");
      }
      const contentByEvidenceId = new Map((contentPayload.content ?? []).map((item) => [item.evidence_id, item]));
      setEvidence((payload.evidence ?? []).map((item) => ({ ...item, extraction: contentByEvidenceId.get(item.id) })));
    } catch (loadError) {
      setEvidence([]);
      setError(loadError instanceof Error ? loadError.message : "Unable to load project evidence.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadEvidence();
    });
  }, [loadEvidence]);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const unsupported = files.find((file) => !ALLOWED_MIME_TYPES.has(file.type));
    setMessage(null);

    if (unsupported) {
      setSelectedFiles([]);
      setError(`Unsupported file type: ${unsupported.name}. Supported types are PDF, DOCX, XLSX, PPTX, and TXT.`);
      return;
    }

    setError(null);
    setSelectedFiles(files);
  };

  const handleUpload = async () => {
    if (!projectId) {
      setError("Project context is required before uploading evidence.");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("Choose at least one evidence file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    selectedFiles.forEach((file) => formData.append("documents", file));

    setIsUploading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = (await response.json()) as UploadResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "Upload failed." : payload.error);
      }
      setSelectedFiles([]);
      setMessage(`Uploaded ${payload.uploadedCount} evidence file(s) to ${payload.projectName}.`);
      await loadEvidence();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload evidence.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (item: EvidenceItem) => {
    if (!projectId) return;

    setDeletingId(item.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/project-evidence", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, projectId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete evidence.");
      }
      setMessage(`Deleted evidence: ${item.file_name}.`);
      await loadEvidence();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete evidence.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-6 shadow-[0_24px_80px_-55px_rgba(34,211,238,0.55)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">Project Evidence</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Evidence Vault</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Upload source artifacts that anchor project intelligence to real documents. Evidence is linked to the active project and remains available after refresh.
            </p>
          </div>
          <Link href={uploadHref} className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10">
            Open Upload Documents
          </Link>
        </div>
      </section>

      {!projectId ? (
        <section className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5 text-sm text-amber-100">
          Select a project from the Operational Shell before using the Project Evidence vault.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Upload Documents</h2>
          <p className="mt-2 text-sm text-slate-400">Supported: PDF, DOCX, XLSX, PPTX, TXT.</p>
          <label className="mt-5 block rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-300/[0.04] p-5 text-center transition hover:border-cyan-200/60">
            <span className="block text-sm font-medium text-cyan-100">Choose evidence files</span>
            <span className="mt-1 block text-xs text-slate-500">Multiple files are supported.</span>
            <input type="file" multiple accept={ACCEPTED_EXTENSIONS} onChange={handleFileSelection} className="sr-only" />
          </label>
          {selectedFiles.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.lastModified}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  {file.name}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={handleUpload}
            disabled={!projectId || isUploading || selectedFiles.length === 0}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
          >
            {isUploading ? "Uploading..." : "Upload Documents"}
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">View Evidence</h2>
              <p className="mt-1 text-sm text-slate-400">Evidence list for the active project.</p>
            </div>
            <button type="button" onClick={() => void loadEvidence()} disabled={!projectId || isLoading} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-50">
              Refresh
            </button>
          </div>

          {message ? <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{message}</p> : null}
          {error ? <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">File Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Upload Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Extraction</th>
                  <th className="px-4 py-3 font-medium">Delete Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading evidence...</td></tr>
                ) : evidence.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No project evidence uploaded yet.</td></tr>
                ) : (
                  evidence.map((item) => (
                    <tr key={item.id} className="bg-slate-950/20">
                      <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-100">{item.file_name}</td>
                      <td className="px-4 py-3">{item.file_type}</td>
                      <td className="px-4 py-3">{formatUploadDate(item.uploaded_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusTone[item.status]}`}>{item.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {item.extraction ? (
                          <div className="space-y-1">
                            <p><span className="text-slate-500">Extracted:</span> {item.extraction.word_count.toLocaleString()} words</p>
                            <p><span className="text-slate-500">Hash:</span> <code>{formatHash(item.extraction.content_hash)}</code></p>
                            <p><span className="text-slate-500">Processing Time:</span> {formatDuration(item.extraction.processing_duration_ms)}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">Awaiting extraction</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void handleDelete(item)} disabled={deletingId === item.id} className="rounded-full border border-rose-300/30 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-50">
                          {deletingId === item.id ? "Deleting..." : "Delete Evidence"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
