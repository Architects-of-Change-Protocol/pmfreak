"use client";

import { useRef, useState, type DragEvent } from "react";
import { EVIDENCE_SOURCE_CATEGORIES, DocumentIcon, type EvidenceSourceCategoryId } from "./intelligence-inbox-icons";
import { EvidenceTimelineCard, type EvidenceTimelineItem } from "./evidence-timeline-card";
import { OperationalMemoryPanel } from "./operational-memory-panel";
import { TextCaptureModal } from "./text-capture-modal";

// Only these are actually ingestible by /api/upload today. Everything else in
// EVIDENCE_SOURCE_CATEGORIES is presented so users see the full range PMFreak
// is built to eventually learn from — dropping an unsupported type is
// acknowledged, not silently swallowed, and never sent to the server.
const SUPPORTED_EXTENSIONS: Record<string, EvidenceSourceCategoryId> = {
  ".pdf": "pdf",
  ".docx": "document",
  ".xlsx": "spreadsheet",
  ".pptx": "presentation",
  ".txt": "document",
};

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? "" : fileName.slice(idx).toLowerCase();
}

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

type QuickAction = {
  id: string;
  label: string;
  comingSoon?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "upload", label: "Upload Files" },
  { id: "paste", label: "Paste Text" },
  { id: "note", label: "Take Note" },
  { id: "gmail", label: "Connect Gmail", comingSoon: true },
  { id: "slack", label: "Connect Slack", comingSoon: true },
  { id: "teams", label: "Connect Teams", comingSoon: true },
  { id: "record", label: "Record Meeting", comingSoon: true },
  { id: "import", label: "Import Documents", comingSoon: true },
];

export function ProjectIntelligenceInbox({
  projectId,
  workspaceId,
  onEvidenceAdded,
  onEnterCommandCenter,
}: {
  projectId: string;
  workspaceId: string;
  onEvidenceAdded?: () => void;
  onEnterCommandCenter?: () => void;
}) {
  const [items, setItems] = useState<EvidenceTimelineItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"paste" | "note" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitFiles = async (fileList: File[]) => {
    const supported: File[] = [];
    const skipped: string[] = [];
    for (const file of fileList) {
      if (SUPPORTED_EXTENSIONS[extensionOf(file.name)]) supported.push(file);
      else skipped.push(file.name);
    }

    if (skipped.length > 0) {
      setNotice(
        `${skipped.length} file${skipped.length === 1 ? "" : "s"} skipped — support for that format is coming soon (PDF, DOCX, XLSX, PPTX, and TXT are ingestible today).`
      );
    } else {
      setNotice(null);
    }

    if (supported.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      for (const file of supported) formData.append("documents", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setNotice(result.error ?? "Upload failed. Your draft evidence was not saved.");
        return;
      }

      const newItems: EvidenceTimelineItem[] = result.files.map((f: { fileName: string; extractionStatus: string }) => ({
        id: nextLocalId(),
        sourceType: SUPPORTED_EXTENSIONS[extensionOf(f.fileName)] ?? "document",
        title: f.fileName,
        uploader: "You",
        timestampMs: Date.now(),
        processingState: f.extractionStatus === "completed" ? "processed" : "processing",
      }));
      setItems((prev) => [...newItems, ...prev]);
      onEvidenceAdded?.();
    } catch {
      setNotice("A network error occurred. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void submitFiles(Array.from(event.dataTransfer.files));
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.comingSoon) {
      setNotice(`${action.label} is coming soon — this integration isn't wired up yet.`);
      return;
    }
    if (action.id === "upload") fileInputRef.current?.click();
    else if (action.id === "paste") setCaptureMode("paste");
    else if (action.id === "note") setCaptureMode("note");
  };

  const handleTextCaptured = (title: string) => {
    setItems((prev) => [
      { id: nextLocalId(), sourceType: "note", title, uploader: "You", timestampMs: Date.now(), processingState: "processed" },
      ...prev,
    ]);
    onEvidenceAdded?.();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Intelligence Inbox</p>
          <p className="mt-1 text-sm text-zinc-500">Feed the Project Brain with operational evidence.</p>
        </div>
        {onEnterCommandCenter && (
          <button
            type="button"
            onClick={onEnterCommandCenter}
            className="rounded-xl border border-cyan-200/60 bg-cyan-400/[0.08] px-5 py-2.5 text-sm font-semibold text-cyan-900 transition hover:bg-cyan-400/[0.16]"
          >
            Enter Command Center →
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* Quick capture actions — entry points into operational memory */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${
                  action.comingSoon
                    ? "border-slate-200 bg-white/70 text-zinc-400 hover:border-slate-300"
                    : "border-slate-200 bg-white text-zinc-700 hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-900"
                }`}
              >
                {action.label}
                {action.comingSoon && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-zinc-400">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Large drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
              isDragging ? "border-cyan-300 bg-cyan-300/10" : "border-slate-200 bg-slate-50 hover:border-cyan-200/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) void submitFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
            <p className="text-sm font-semibold text-slate-800">Drop anything related to this project.</p>
            <p className="mt-1 text-xs text-zinc-400">
              {isUploading ? "Uploading and learning…" : "Or click Upload Files above to browse."}
            </p>

            <div className="mx-auto mt-5 grid max-w-2xl grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
              {EVIDENCE_SOURCE_CATEGORIES.map(({ id, label, Icon }) => (
                <div
                  key={id}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white/60 px-2 py-3"
                  title={label}
                >
                  <Icon className="h-4 w-4 text-zinc-400" />
                  <span className="text-center text-[9px] leading-tight text-zinc-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {notice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-800">
              {notice}
            </div>
          )}

          {/* Intelligence timeline */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Intelligence Timeline</p>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-zinc-300">
                  <DocumentIcon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">Nothing has been learned yet.</p>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  Feed your Project Brain with project evidence.
                  <br />
                  Everything added here becomes searchable, connected, and available to AI agents.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <EvidenceTimelineCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>

        <OperationalMemoryPanel evidenceCount={items.length} />
      </div>

      {captureMode && (
        <TextCaptureModal
          mode={captureMode}
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setCaptureMode(null)}
          onCaptured={handleTextCaptured}
        />
      )}
    </div>
  );
}
