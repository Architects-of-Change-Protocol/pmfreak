"use client";

import { useMemo, useState } from "react";
import type { OperationalSummary } from "@/lib/operational-flow/types";
import type { Agent, ChatMessage, DrawerContent, MemoryItem, NeedsYouItem, ProjectListItem } from "../../presentation/command-center/types";
import { deriveAgents, deriveNeedsYou, deriveRepository, postOperationalFlow, useOperationalFlow } from "../../presentation/command-center/operational-data";
import type { DecisionStatus } from "../../presentation/command-center/operational-data";
import { chatMessagesToConversationTurns, conversationResultToAssistantMessage, postConversationMessage } from "../../presentation/command-center/conversation-data";
import { ProjectSidebar } from "../../presentation/command-center/project-sidebar";
import { ProjectTopBar } from "../../presentation/command-center/project-top-bar";
import { CommandFeed } from "../../presentation/command-center/command-feed";
import { NeedsYouQueue } from "../../presentation/command-center/needs-you-queue";
import { AgentDock } from "../../presentation/command-center/agent-dock";
import { DetailDrawer } from "../../presentation/command-center/detail-drawer";
import { VaultIntakePanel } from "../../presentation/command-center/vault-intake-panel";
import { CloseIcon } from "../../presentation/command-center/icons";

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Memory categories backed by real operational records only — empty when nothing is recorded. */
function deriveMemory(data: OperationalSummary | undefined): MemoryItem[] {
  if (!data) return [];
  const decisions = data.decisions.length;
  const risks = data.risksIssues.length;
  const commitments = data.decisions.filter((d) => d.decision_status === "accepted").length;
  return [
    decisions > 0 ? { id: "decisions", label: `Decisions · ${decisions}` } : null,
    risks > 0 ? { id: "risks", label: `Risks · ${risks}` } : null,
    commitments > 0 ? { id: "commitments", label: `Commitments · ${commitments}` } : null,
  ].filter(Boolean) as MemoryItem[];
}

/** Newest timestamp across real operational records, as a human-readable relative label.
 *  Returns undefined when there is no data — the UI then shows no timestamp at all. */
function deriveLastUpdatedLabel(data: OperationalSummary | undefined): string | undefined {
  if (!data) return undefined;
  let latest = 0;
  for (const record of [...data.evidence, ...data.signals, ...data.decisions]) {
    for (const key of ["updated_at", "created_at"]) {
      const raw = record[key];
      if (typeof raw !== "string") continue;
      const time = Date.parse(raw);
      if (!Number.isNaN(time) && time > latest) latest = time;
    }
  }
  if (latest === 0) return undefined;
  const minutes = Math.floor((Date.now() - latest) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(latest).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function buildRealMessages(project: ProjectListItem, needsYou: NeedsYouItem[]): ChatMessage[] {
  const welcome: ChatMessage = {
    id: "welcome",
    role: "assistant",
    content: `${project.fullName} is ready. I can help you review changes, spot risks, prepare updates, create tasks, or generate a project brief.`,
  };
  const topItems = needsYou.slice(0, 3).map((item) => item.title);
  if (topItems.length === 0) {
    return [welcome];
  }
  return [
    welcome,
    {
      id: "summary",
      role: "assistant",
      content:
        topItems.length === 1
          ? "One thing needs your attention right now."
          : `${topItems.length} things need your attention right now.`,
      structuredList: topItems,
    },
  ];
}

function MobileOverlay({ open, onClose, side, children }: { open: boolean; onClose: () => void; side: "left" | "right"; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-30 xl:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-slate-900/20 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`absolute top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl transition-transform duration-200 ${
          side === "left" ? `left-0 ${open ? "translate-x-0" : "-translate-x-full"}` : `right-0 ${open ? "translate-x-0" : "translate-x-full"}`
        }`}
      >
        <div className="flex justify-end p-2">
          <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-2.5rem)]">{children}</div>
      </div>
    </div>
  );
}

export function CommandCenterLayout({
  workspaceName,
  workspaceId,
  projects,
  activeProjectId,
  hasBrief = false,
  onSelectProject,
  onEvidenceAdded,
}: {
  workspaceName: string;
  /** Real workspace id, used to load/record project evidence and decisions. */
  workspaceId: string;
  projects: ProjectListItem[];
  activeProjectId?: string;
  /** Whether a governance brief already exists for the active project (drives the Executive Briefing agent card). */
  hasBrief?: boolean;
  /** Called when the user picks a different project. Use this to navigate so the new
   *  project's server-scoped data (governance brief, etc.) is actually loaded — selecting
   *  a project only updates local UI state otherwise. */
  onSelectProject?: (id: string) => void;
  /** Called after new project evidence is added (e.g. to refresh the governance brief). */
  onEvidenceAdded?: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? projects[0]?.id ?? "");

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    onSelectProject?.(id);
  };

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );

  const { data: flowData, mutate: mutateFlow } = useOperationalFlow(workspaceId, selectedProject?.id ?? "");
  const hasRealData = Boolean(flowData && flowData.evidence.length > 0);
  const flowLoading = flowData === undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInteracted, setUserInteracted] = useState(false);
  // Tracks whether the chat has been seeded from the first real operational-flow load for this
  // mount (a fresh mount — and fresh seeding — happens automatically whenever the active project
  // changes, since the page keys CommandCenterClient by projectId).
  const [seededFromFlowData, setSeededFromFlowData] = useState<typeof flowData>(undefined);

  if (!userInteracted && seededFromFlowData === undefined && flowData !== undefined && selectedProject) {
    setSeededFromFlowData(flowData);
    if (hasRealData) {
      setMessages(buildRealMessages(selectedProject, deriveNeedsYou(flowData, () => {})));
    } else {
      // Honest first message: no invented findings, no fake sources — just the real state.
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `${selectedProject.fullName} has no recorded project data yet. Add your first notes and I'll start tracking risks, commitments, and decisions from them.`,
        },
      ]);
    }
  }

  const [drawerContent, setDrawerContent] = useState<DrawerContent | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const handleDecide = async (recommendationId: string, status: DecisionStatus, authorityRequired: string) => {
    const decisionStatus = status === "deferred" ? "escalated" : status;
    try {
      await postOperationalFlow(workspaceId, selectedProject?.id ?? "", {
        operation: "record_decision",
        recommendationId,
        decisionStatus,
        decision: `Recommendation ${status} by an authorized reviewer.`,
        rationale: `Decision recorded from Command Center. Authority: ${authorityRequired}.`,
      });
      await mutateFlow();
      setDrawerContent(null);
    } catch {
      // Leave the drawer open so the user can retry.
    }
  };

  const needsYouReal = useMemo(() => deriveNeedsYou(flowData, handleDecide), [flowData]); // eslint-disable-line react-hooks/exhaustive-deps
  const repositoryReal = useMemo(() => deriveRepository(flowData), [flowData]);
  const agentsReal = useMemo(() => deriveAgents(flowData, hasBrief), [flowData, hasBrief]);
  const memoryReal = useMemo(() => deriveMemory(flowData), [flowData]);
  const lastUpdatedLabel = useMemo(() => deriveLastUpdatedLabel(flowData), [flowData]);

  // Real data or nothing: sections render honest empty states instead of fixtures.
  const needsYouItems = hasRealData ? needsYouReal : [];
  const repositoryItems = repositoryReal;
  const agentItems = hasRealData ? agentsReal : [];

  const handleSendMessage = (text: string) => {
    setUserInteracted(true);
    const userMessage: ChatMessage = { id: nextId("user"), role: "user", content: text };
    let historyForGateway: ChatMessage[] = [];
    setMessages((current) => {
      const next = [...current, userMessage];
      historyForGateway = next;
      return next;
    });

    void postConversationMessage({
      message: text,
      workspaceId,
      activeProjectId: selectedProject?.id,
      activeProjectName: selectedProject?.fullName,
      conversationHistory: chatMessagesToConversationTurns(historyForGateway),
    })
      .then((result) => {
        setMessages((current) => [...current, conversationResultToAssistantMessage(nextId("assistant"), result)]);
      })
      .catch(() => {
        setMessages((current) => [
          ...current,
          {
            id: nextId("assistant"),
            role: "assistant",
            content: "Sorry — I couldn't process that just now. Please try again in a moment.",
          },
        ]);
      });
  };

  // Suggested-action chips post the action through the real gateway — no faked
  // "starting on..." confirmation for work nothing is actually doing.
  const handleActionClick = (action: string) => {
    handleSendMessage(action);
  };

  const handleSourceClick = (source: string) => {
    setDrawerContent({
      title: source,
      why: "This source was used to help answer your question.",
      evidence: [source],
      nextStep: "Open the source to see the full context.",
    });
  };

  const handleNeedsYouSelect = (item: NeedsYouItem) => setDrawerContent(item.drawer);
  const handleAgentSelect = (agent: Agent) => setDrawerContent(agent.drawer);

  const handleIntakeComplete = (summary: string) => {
    setUserInteracted(true);
    setMessages((current) => [...current, { id: nextId("assistant"), role: "assistant", content: summary }]);
    void mutateFlow();
    onEvidenceAdded?.();
  };

  if (!selectedProject) return null;

  return (
    <div
      data-build="command-center-light-v2"
      data-shell="pmfreak-light-command-center"
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#FCFBF9] shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)]"
    >
      <ProjectTopBar
        project={selectedProject}
        onOpenProjects={() => setLeftOpen(true)}
        onOpenAgents={() => setRightOpen(true)}
        lastUpdatedLabel={lastUpdatedLabel}
      />

      <div className="flex min-h-[600px] xl:h-[calc(100vh-190px)]">
        <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-white/60 xl:block">
          <ProjectSidebar
            workspaceName={workspaceName}
            projects={projects}
            selectedProjectId={selectedProject.id}
            onSelectProject={handleSelectProject}
            repository={repositoryItems}
            memory={memoryReal}
            onAddNotes={() => setNotesOpen(true)}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {notesOpen && (
            <div className="border-b border-slate-200 p-4">
              <VaultIntakePanel
                workspaceId={workspaceId}
                projectId={selectedProject.id}
                onClose={() => setNotesOpen(false)}
                onIntakeComplete={handleIntakeComplete}
              />
            </div>
          )}
          <div className="min-h-0 flex-1">
            <CommandFeed
              messages={messages}
              onSendMessage={handleSendMessage}
              onSourceClick={handleSourceClick}
              onActionClick={handleActionClick}
              onOpenNotes={() => setNotesOpen((v) => !v)}
            />
          </div>
        </main>

        <aside className="hidden w-[320px] shrink-0 space-y-6 overflow-y-auto border-l border-slate-200 bg-white/60 p-4 xl:block">
          <NeedsYouQueue items={needsYouItems} onSelect={handleNeedsYouSelect} loading={flowLoading} onAddNotes={() => setNotesOpen(true)} />
          <AgentDock agents={agentItems} onSelect={handleAgentSelect} loading={flowLoading} onAddContext={() => setNotesOpen(true)} />
        </aside>
      </div>

      <MobileOverlay open={leftOpen} onClose={() => setLeftOpen(false)} side="left">
        <ProjectSidebar
          workspaceName={workspaceName}
          projects={projects}
          selectedProjectId={selectedProject.id}
          onSelectProject={(id) => {
            handleSelectProject(id);
            setLeftOpen(false);
          }}
          repository={repositoryItems}
          memory={memoryReal}
          onAddNotes={() => {
            setNotesOpen(true);
            setLeftOpen(false);
          }}
        />
      </MobileOverlay>

      <MobileOverlay open={rightOpen} onClose={() => setRightOpen(false)} side="right">
        <div className="space-y-6 overflow-y-auto p-4">
          <NeedsYouQueue
            items={needsYouItems}
            onSelect={handleNeedsYouSelect}
            loading={flowLoading}
            onAddNotes={() => {
              setNotesOpen(true);
              setRightOpen(false);
            }}
          />
          <AgentDock
            agents={agentItems}
            onSelect={handleAgentSelect}
            loading={flowLoading}
            onAddContext={() => {
              setNotesOpen(true);
              setRightOpen(false);
            }}
          />
        </div>
      </MobileOverlay>

      <DetailDrawer content={drawerContent} onClose={() => setDrawerContent(null)} />
    </div>
  );
}
