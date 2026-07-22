"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EVIDENCE_SOURCE_CATEGORIES, BrainPulseIcon, type EvidenceSourceCategoryId } from "./intelligence-inbox-icons";
import { EvidenceTimelineCard, type EvidenceTimelineItem, type EvidenceProcessingState } from "./evidence-timeline-card";
import { OperationalMemoryPanel } from "./operational-memory-panel";
import { KnowledgeGapsPanel } from "./knowledge-gaps-panel";
import { TextCaptureModal } from "./text-capture-modal";
import { ProjectBrainIntroduction } from "@/components/pmfreak/project-brain/project-brain-introduction";
import { buildInitialProjectBrainResponse } from "@/lib/project-brain/validate-response-pipeline";
import type { ProjectOnboardingSnapshot } from "@/lib/project-brain/derive-initial-response";

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

// project_evidence.status IS the real pipeline stage — this is a direct
// relabeling of real server state, never a synthetic progress guess.
function processingStateFromServerStatus(status: string): EvidenceProcessingState {
  if (status === "processed") return "processed";
  if (status === "failed") return "failed";
  if (status === "processing") return "processing";
  return "stored"; // "uploaded" — persisted but extraction hasn't started yet
}

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 20; // ~50s — after that, the card honestly stays on "stored"/"processing" rather than claiming completion

async function fetchProjectEvidenceRows(projectId: string): Promise<Array<{ id: string; file_name: string; file_type: string; uploaded_at: string; status: ServerEvidenceStatus }>> {
  const response = await fetch(`/api/project-evidence?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
  if (!response.ok) return [];
  const result = await response.json();
  return (result.evidence ?? []) as Array<{ id: string; file_name: string; file_type: string; uploaded_at: string; status: ServerEvidenceStatus }>;
}

// Polls the real project_evidence row until the background extractor lands
// on a terminal status. The card reflects whatever the row actually says at
// each poll — it never advances on a timer independent of that row.
function pollEvidenceStatus(
  itemId: string,
  evidenceId: string,
  projectId: string,
  attempt: number,
  setItems: React.Dispatch<React.SetStateAction<EvidenceTimelineItem[]>>,
) {
  if (attempt >= MAX_POLL_ATTEMPTS) return;
  setTimeout(async () => {
    try {
      const rows = await fetchProjectEvidenceRows(projectId);
      const row = rows.find((r) => r.id === evidenceId);
      if (!row) {
        pollEvidenceStatus(itemId, evidenceId, projectId, attempt + 1, setItems);
        return;
      }
      const nextState = processingStateFromServerStatus(row.status);
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, processingState: nextState } : item)));
      if (nextState === "processed" || nextState === "failed") return;
    } catch {
      // Transient network hiccup — keep polling rather than giving up early.
    }
    pollEvidenceStatus(itemId, evidenceId, projectId, attempt + 1, setItems);
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
  projectName,
  createdAt,
  onboarding,
  onEvidenceAdded,
  onEnterCommandCenter,
}: {
  projectId: string;
  workspaceId: string;
  projectName: string;
  /** ISO timestamp the project was created — used only as the recorded-at value for "Project configuration" source references. */
  createdAt: string;
  /** The project's onboarding payload, when one exists — feeds the deterministic initial Project Brain response. */
  onboarding: ProjectOnboardingSnapshot | null;
  onEvidenceAdded?: () => void;
  onEnterCommandCenter?: () => void;
}) {
  const [items, setItems] = useState<EvidenceTimelineItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<"paste" | "note" | null>(null);
  const [confirmation, setConfirmation] = useState<{ id: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showConfirmation = (title: string) => {
    const confirmationId = nextLocalId();
    setConfirmation({ id: confirmationId, title });
    setTimeout(() => {
      setConfirmation((current) => (current?.id === confirmationId ? null : current));
    }, 2600);
  };

  // Load the project's already-persisted evidence on arrival — otherwise a
  // refresh (or revisiting this screen) would falsely claim Project Memory
  // is empty when /api/upload already saved evidence in an earlier visit.
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
        if (item.processingState !== "processed" && item.processingState !== "failed") {
          pollEvidenceStatus(item.id, item.evidenceId!, projectId, 0, setItems);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const evidenceSummary = useMemo(
    () => ({
      totalCount: items.length,
      processedCount: items.filter((i) => i.processingState === "processed").length,
      failedCount: items.filter((i) => i.processingState === "failed").length,
    }),
    [items],
  );

  const projectBrainResult = useMemo(
    () =>
      buildInitialProjectBrainResponse({
        project: { projectId, workspaceId, projectName, createdAt, onboarding },
        evidence: evidenceSummary,
        generatedAt: createdAt,
      }),
    [projectId, workspaceId, projectName, createdAt, onboarding, evidenceSummary],
  );
  const projectBrainResponse = projectBrainResult.ok ? projectBrainResult.response : null;

  const trackNewItems = (newItems: EvidenceTimelineItem[]) => {
    setItems((prev) => [...newItems, ...prev]);
    for (const item of newItems) {
      if (item.evidenceId) {
        // A real upload — only the server's own background extractor gets to
        // decide when extraction has actually completed.
        pollEvidenceStatus(item.id, item.evidenceId, projectId, 0, setItems);
      } else {
        // Manual text capture — the content is already fully persisted by
        // the time we get a result; there is no separate extraction step.
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, processingState: "stored" } : i)));
      }
      showConfirmation(item.title);
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

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      for (const file of supported) formData.append("documents", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        setNotice(result.error ?? "I could not add this evidence to Project Memory. Nothing was stored.");
        return;
      }

      const newItems: EvidenceTimelineItem[] = result.files.map((f: { fileName: string; evidenceId: string }) => ({
        id: nextLocalId(),
        evidenceId: f.evidenceId,
        sourceType: SUPPORTED_EXTENSIONS[extensionOf(f.fileName)] ?? "document",
        title: f.fileName,
        uploader: "You",
        timestampMs: Date.now(),
        processingState: "stored",
      }));
      trackNewItems(newItems);
    } catch {
      setNotice("A network error occurred. Nothing was stored. Please try again.");
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
      setNotice(`${action.label} is coming soon — this connector isn't wired up yet.`);
      return;
    }
    if (action.id === "upload") fileInputRef.current?.click();
    else if (action.id === "paste") setCaptureMode("paste");
    else if (action.id === "note") setCaptureMode("note");
  };

  const handleTextCaptured = (title: string) => {
    trackNewItems([
      { id: nextLocalId(), sourceType: "note", title, uploader: "You", timestampMs: Date.now(), processingState: "stored" },
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Memory</p>
          <p className="mt-1 text-sm text-zinc-500">
            Everything added here becomes part of this project&apos;s Project Memory.
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

      <ProjectBrainIntroduction
        projectName={projectName}
        response={projectBrainResponse}
        onAddEvidence={() => fileInputRef.current?.click()}
        onCaptureContext={() => setCaptureMode("paste")}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* Quick capture actions — entry points into Project Memory, not a file picker */}
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-zinc-400">Add to Project Memory</p>
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
            <p className="text-sm font-semibold text-slate-800">Drop anything relevant to this project.</p>
            <p className="mt-1 text-xs text-zinc-400">
              {isUploading ? "Uploading…" : "Or click Add Evidence above to browse."}
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

          {/* Project Memory timeline — what has actually been added, and its real storage/processing state */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-400">Project Memory Timeline</p>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-cyan-600">
                  <BrainPulseIcon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">Project Memory is empty.</p>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-400">
                  Nothing has been added yet, so I don&apos;t yet know your stakeholders, delivery risks,
                  contractual commitments, technical decisions, or project history.
                </p>
                <p className="mt-2 text-xs font-medium text-cyan-700">Add evidence to give me something to work from.</p>
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
          <OperationalMemoryPanel evidenceCount={items.length} response={projectBrainResponse} />
          <KnowledgeGapsPanel gaps={projectBrainResponse?.knowledgeGaps ?? []} />
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
        {confirmation && (
          <motion.div
            key={confirmation.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed bottom-6 right-6 z-40 max-w-xs rounded-xl border border-cyan-200/60 bg-white px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.15)]"
          >
            <p className="text-xs font-semibold text-slate-900">Added to Project Memory.</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">&ldquo;{confirmation.title}&rdquo;</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
