"use client";

import { useMemo, useState } from "react";
import type { Agent, ChatMessage, DrawerContent, NeedsYouItem, ProjectListItem } from "./types";
import { DEMO_AGENTS, DEMO_CHAT, DEMO_MEMORY, DEMO_NEEDS_YOU, DEMO_REPOSITORY } from "./demo-data";
import { ProjectSidebar } from "./project-sidebar";
import { ProjectTopBar } from "./project-top-bar";
import { CommandFeed } from "./command-feed";
import { NeedsYouQueue } from "./needs-you-queue";
import { AgentDock } from "./agent-dock";
import { DetailDrawer } from "./detail-drawer";
import { CloseIcon } from "./icons";

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  projects,
  activeProjectId,
  onSelectProject,
}: {
  workspaceName: string;
  projects: ProjectListItem[];
  activeProjectId?: string;
  /** Called when the user picks a different project. Use this to navigate so the new
   *  project's server-scoped data (governance brief, etc.) is actually loaded — selecting
   *  a project only updates local UI state otherwise. */
  onSelectProject?: (id: string) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? projects[0]?.id ?? "");

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    onSelectProject?.(id);
  };
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_CHAT);
  const [drawerContent, setDrawerContent] = useState<DrawerContent | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId]
  );

  const handleSendMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      { id: nextId("user"), role: "user", content: text },
      {
        id: nextId("assistant"),
        role: "assistant",
        content: "Thanks — I'm still learning to answer that in this preview. Try one of the suggested prompts below.",
      },
    ]);
  };

  const handleActionClick = (action: string) => {
    setMessages((current) => [
      ...current,
      {
        id: nextId("assistant"),
        role: "assistant",
        content: `Okay — starting on "${action}". Anything that reaches your client or team is routed to you for approval first.`,
      },
    ]);
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

  if (!selectedProject) return null;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#FCFBF9] shadow-[0_40px_90px_-60px_rgba(15,23,42,0.35)]">
      <ProjectTopBar project={selectedProject} onOpenProjects={() => setLeftOpen(true)} onOpenAgents={() => setRightOpen(true)} />

      <div className="flex min-h-[600px] xl:h-[calc(100vh-190px)]">
        <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-white/60 xl:block">
          <ProjectSidebar
            workspaceName={workspaceName}
            projects={projects}
            selectedProjectId={selectedProject.id}
            onSelectProject={handleSelectProject}
            repository={DEMO_REPOSITORY}
            memory={DEMO_MEMORY}
          />
        </aside>

        <main className="min-w-0 flex-1">
          <CommandFeed
            messages={messages}
            onSendMessage={handleSendMessage}
            onSourceClick={handleSourceClick}
            onActionClick={handleActionClick}
          />
        </main>

        <aside className="hidden w-[320px] shrink-0 space-y-6 overflow-y-auto border-l border-slate-200 bg-white/60 p-4 xl:block">
          <NeedsYouQueue items={DEMO_NEEDS_YOU} onSelect={handleNeedsYouSelect} />
          <AgentDock agents={DEMO_AGENTS} onSelect={handleAgentSelect} />
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
          repository={DEMO_REPOSITORY}
          memory={DEMO_MEMORY}
        />
      </MobileOverlay>

      <MobileOverlay open={rightOpen} onClose={() => setRightOpen(false)} side="right">
        <div className="space-y-6 overflow-y-auto p-4">
          <NeedsYouQueue items={DEMO_NEEDS_YOU} onSelect={handleNeedsYouSelect} />
          <AgentDock agents={DEMO_AGENTS} onSelect={handleAgentSelect} />
        </div>
      </MobileOverlay>

      <DetailDrawer content={drawerContent} onClose={() => setDrawerContent(null)} />
    </div>
  );
}
