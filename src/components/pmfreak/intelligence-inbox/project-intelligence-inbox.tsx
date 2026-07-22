"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EVIDENCE_SOURCE_CATEGORIES, BrainPulseIcon, type EvidenceSourceCategoryId } from "./intelligence-inbox-icons";
import { EvidenceTimelineCard, type EvidenceTimelineItem, type EvidenceProcessingState } from "./evidence-timeline-card";
import { OperationalMemoryPanel } from "./operational-memory-panel";
import { KnowledgeGapsPanel } from "./knowledge-gaps-panel";
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

function sourceTypeFromFileType(fileType: string): EvidenceSourceCategoryId {
  const normalized = fileType.toLowerCase();
  if (normalized.includes("pdf")) return "pdf";
  if (normalized.includes("xlsx") || normalized.includes("sheet")) return "spreadsheet";
  if (normalized.includes("pptx") || normalized.includes("presentation")) return "presentation";
  return "document";
}

type ServerEvidenceStatus = "uploaded" | "processing" | "processed" | "failed";

// project_evidence.status names the real pipeline stage; "reading"/"updating"
// are just where that maps in the thinking-stage vocabulary the UI already
// uses — no synthetic progress, only a relabeling of real server state.
function processingStateFromServerStatus(status: string): EvidenceProcessingState {
  if (status === "processed") return "learned";
  if (status === "failed") return "failed";
  if (status === "processing") return "updating";
  return "reading"; // "uploaded" — persisted but extraction hasn't started yet
}

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

// The Project Brain's cosmetic reasoning pass, walked automatically after any
// evidence arrives. Ends at "updating", not "learned" — the terminal state is
// never fabricated on a timer; it comes from the real server-side status
// (see pollEvidenceStatus) or, for manual text captures, from the fact that
// postOperationalFlow's run_chain call already completed synchronously.
const THINKING_STAGES: EvidenceProcessingState[] = ["receiving", "reading", "extracting", "updating"];
const THINKING_STAGE_MS = 550;

function advanceCosmeticThinking(
  itemId: string,
  stageIndex: number,
  setItems: React.Dispatch<React.SetStateAction<EvidenceTimelineItem[]>>,
  onCosmeticDone: () => void
) {
  const nextIndex = stageIndex + 1;
  if (nextIndex >= THINKING_STAGES.length) {
    onCosmeticDone();
    return;
  }
  setTimeout(() => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, processingState: THINKING_STAGES[nextIndex] } : item)));
    advanceCosmeticThinking(itemId, nextIndex, setItems, onCosmeticDone);
  }, THINKING_STAGE_MS);
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 20; // ~50s — after that, the card honestly stays on "updating" rather than claiming completion

async function fetchProjectEvidenceRows(projectId: string): Promise<Array<{ id: string; file_name: string; file_type: string; uploaded_at: string; status: ServerEvidenceStatus }>> {
  const response = await fetch(`/api/project-evidence?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
  if (!response.ok) return [];
  const result = await response.json();
  return (result.evidence ?? []) as Array<{ id: string; file_name: string; file_type: string; uploaded_at: string; status: ServerEvidenceStatus }>;
}

// Polls the real project_evidence row until the background extractor lands
// on a terminal status. Never advances an item to "learned" on its own —
// that only happens once the server actually confirms "processed".
function pollEvidenceStatus(
  itemId: string,
  evidenceId: string,
  projectId: string,
  attempt: number,
  setItems: React.Dispatch<React.SetStateAction<EvidenceTimelineItem[]>>,
  onLearned: () => void
) {
  if (attempt >= MAX_POLL_ATTEMPTS) return;
  setTimeout(async () => {
    try {
      const rows = await fetchProjectEvidenceRows(projectId);
      const row = rows.find((r) => r.id === evidenceId);
      if (row?.status === "processed") {
        setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, processingState: "learned" } : item)));
        onLearned();
        return;
      }
      if (row?.status === "failed") {
        setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, processingState: "failed" } : item)));
        return;
      }
    } catch {
      // Transient network hiccup — keep polling rather than giving up early.
    }
    pollEvidenceStatus(itemId, evidenceId, projectId, attempt + 1, setItems, onLearned);
  }, POLL_INTERVAL_MS);
}

type QuickAction = {
  id: string;
  label: string;
  comingSoon?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "upload", label: "Add Evidence" },
  { id: "paste", label: "Capture Context" },
  { id: "note", label: "Take a Note" },
  { id: "gmail", label: "Connect Gmail", comingSoon: true },
  { id: "slack", label: "Connect Slack", comingSoon: true },
  { id: "teams", label: "Connect Teams", comingSoon: true },
  { id: "record", label: "Record Meeting", comingSoon: true },
  { id: "import", label: "Import Historical Context", comingSoon: true },
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
  const [isReceiving, setIsReceiving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"paste" | "note" | null>(null);
  const [momentum, setMomentum] = useState<{ id: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const learnedCount = items.filter((item) => item.processingState === "learned").length;
  const understandingPercent = Math.min(learnedCount * 7, 42);

  const triggerMomentum = (title: string) => {
    const momentumId = nextLocalId();
    setMomentum({ id: momentumId, title });
    setTimeout(() => {
      setMomentum((current) => (current?.id === momentumId ? null : current));
    }, 2600);
  };

  // Load the project's already-persisted evidence on arrival — otherwise a
  // refresh (or revisiting this screen) would falsely claim the brain knows
  // nothing when /api/upload already saved evidence in an earlier visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchProjectEvidenceRows(projectId);
      if (cancelled || rows.length === 0) return;
      const loaded: EvidenceTimelineItem[] = rows.map((row) => ({
        id: row.id,
        evidenceId: row.id,
        sourceType: sourceTypeFromFileType(row.file_type),
        title: row.file_name,
        uploader: "Project team",
        timestampMs: new Date(row.uploaded_at).getTime(),
        processingState: processingStateFromServerStatus(row.status),
      }));
      setItems((prev) => {
        const existingEvidenceIds = new Set(prev.map((item) => item.evidenceId).filter(Boolean));
        const fresh = loaded.filter((item) => !existingEvidenceIds.has(item.evidenceId));
        return [...prev, ...fresh].sort((a, b) => b.timestampMs - a.timestampMs);
      });
      for (const item of loaded) {
        if (item.processingState !== "learned" && item.processingState !== "failed") {
          pollEvidenceStatus(item.id, item.evidenceId!, projectId, 0, setItems, () => {});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const beginLearning = (newItems: EvidenceTimelineItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    for (const item of newItems) {
      advanceCosmeticThinking(item.id, 0, setItems, () => {
        if (item.evidenceId) {
          // A real upload — only the server's own background extractor gets
          // to decide when this is actually learned.
          pollEvidenceStatus(item.id, item.evidenceId, projectId, 0, setItems, () => triggerMomentum(item.title));
        } else {
          // Manual text capture — postOperationalFlow's run_chain call has
          // already completed synchronously by the time we got a result.
          setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, processingState: "learned" } : i)));
          triggerMomentum(item.title);
        }
      });
    }
    onEvidenceAdded?.();
  };

  const submitFiles = async (fileList: File[]) => {
    const supported: File[] = [];
    const skipped: string[] = [];
    for (const file of fileList) {
      if (SUPPORTED_EXTENSIONS[extensionOf(file.name)]) supported.push(file);
      else skipped.push(file.name);
    }

    if (skipped.length > 0) {
      setNotice(
        `${skipped.length} item${skipped.length === 1 ? "" : "s"} the brain can't read yet — support for that format is coming soon (PDF, DOCX, XLSX, PPTX, and TXT are teachable today).`
      );
    } else {
      setNotice(null);
    }

    if (supported.length === 0) return;

    setIsReceiving(true);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      for (const file of supported) formData.append("documents", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setNotice(result.error ?? "The Project Brain couldn't take that in. Nothing was saved.");
        return;
      }

      const newItems: EvidenceTimelineItem[] = result.files.map((f: { fileName: string; evidenceId: string }) => ({
        id: nextLocalId(),
        evidenceId: f.evidenceId,
        sourceType: SUPPORTED_EXTENSIONS[extensionOf(f.fileName)] ?? "document",
        title: f.fileName,
        uploader: "You",
        timestampMs: Date.now(),
        processingState: "receiving",
      }));
      beginLearning(newItems);
    } catch {
      setNotice("A network error occurred. Please try again.");
    } finally {
      setIsReceiving(false);
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
      setNotice(`${action.label} is coming soon — this connector isn't wired up yet.`);
      return;
    }
    if (action.id === "upload") fileInputRef.current?.click();
    else if (action.id === "paste") setCaptureMode("paste");
    else if (action.id === "note") setCaptureMode("note");
  };

  const handleTextCaptured = (title: string) => {
    beginLearning([
      { id: nextLocalId(), sourceType: "note", title, uploader: "You", timestampMs: Date.now(), processingState: "receiving" },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Memory</p>
          <p className="mt-1 text-sm text-zinc-500">
            Every piece of evidence you add teaches your Project Brain something new about this project.
          </p>
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
          {/* Quick capture actions — entry points into operational memory, not a file picker */}
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-zinc-400">Teach Your Brain</p>
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
            <p className="text-sm font-semibold text-slate-800">Drop anything that teaches your Project Brain about this project.</p>
            <p className="mt-1 text-xs text-zinc-400">
              {isReceiving ? "Receiving evidence…" : "Or click Add Evidence above to browse."}
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

          {/* Intelligence timeline — the evolution of project understanding, not a file list */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Intelligence Timeline</p>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-cyan-600">
                  <BrainPulseIcon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">Your Project Brain is online.</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-400">
                  Right now it knows almost nothing. It cannot yet understand your stakeholders, delivery risks,
                  contractual commitments, technical decisions, or project history.
                </p>
                <p className="mt-2 text-xs font-medium text-cyan-700">Teach it by adding operational evidence.</p>
              </div>
            ) : (
              <div className="relative space-y-2.5 pl-4">
                <div className="pointer-events-none absolute left-[3px] top-3 bottom-3 w-px bg-gradient-to-b from-cyan-300/60 via-slate-200 to-transparent" />
                {items.map((item) => (
                  <div key={item.id} className="relative">
                    <span className="absolute -left-4 top-5 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
                    <EvidenceTimelineCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <OperationalMemoryPanel evidenceCount={items.length} understandingPercent={understandingPercent} />
          <KnowledgeGapsPanel />
        </div>
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

      <AnimatePresence>
        {momentum && (
          <motion.div
            key={momentum.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed bottom-6 right-6 z-40 max-w-xs rounded-xl border border-cyan-200/60 bg-white px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.15)]"
          >
            <p className="text-xs font-semibold text-slate-900">Your Project Brain just got smarter.</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">Learned from &ldquo;{momentum.title}&rdquo;</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
