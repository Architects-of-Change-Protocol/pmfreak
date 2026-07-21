import type { Agent, ChatMessage, MemoryItem, NeedsYouItem, ProjectListItem, RepositoryItem } from "./types";

export const DEMO_WORKSPACE_NAME = "Demo PMO";

export const DEMO_PROJECTS: ProjectListItem[] = [
  {
    id: "bnr-15959",
    code: "BNR-15959",
    name: "Banrural",
    fullName: "Banrural Honduras",
    badges: [
      { tone: "danger", label: "2" },
      { tone: "task", label: "3" },
      { tone: "approval", label: "1" },
    ],
  },
  {
    id: "mep-14156",
    code: "MEP-14156",
    name: "MEP",
    fullName: "MEP",
    badges: [{ tone: "task", label: "4" }],
  },
  {
    id: "hmp-14665",
    code: "HMP-14665",
    name: "Max Peralta",
    fullName: "Max Peralta",
    badges: [{ tone: "approval", label: "1" }],
  },
  {
    id: "gch-15992",
    code: "GCH-15992",
    name: "Grupo Cachos",
    fullName: "Grupo Cachos",
    badges: [],
    healthy: true,
  },
];

export const DEMO_REPOSITORY: RepositoryItem[] = [
  { id: "documents", label: "Documents", icon: "document", count: 18 },
  { id: "emails", label: "Emails", icon: "mail", count: 42 },
  { id: "meeting-notes", label: "Meeting notes", icon: "notes", count: 9 },
  { id: "chats", label: "Chats", icon: "chat", count: 6 },
  { id: "attachments", label: "Attachments", icon: "attachment", count: 11 },
  { id: "decisions", label: "Decisions", icon: "decision", count: 5 },
  { id: "commitments", label: "Commitments", icon: "commitment", count: 7 },
  { id: "evidence", label: "Evidence", icon: "evidence", count: 12 },
];

export const DEMO_MEMORY: MemoryItem[] = [
  { id: "decisions", label: "Decisions" },
  { id: "risks", label: "Risks" },
  { id: "commitments", label: "Commitments" },
  { id: "approvals", label: "Approvals" },
  { id: "lessons", label: "Lessons learned" },
];

export const DEMO_NEEDS_YOU: NeedsYouItem[] = [
  {
    id: "approve-client-update",
    title: "Approve client update",
    badge: { tone: "approval", label: "Approval" },
    drawer: {
      title: "Approve client update",
      why: "A client-facing update is drafted and ready, but it needs your sign-off before it goes out.",
      evidence: ["Draft update, prepared today", "Meeting note, June 26", "Task #104"],
      nextStep: "Review the draft and approve it, or send it back with notes.",
    },
  },
  {
    id: "review-risk-escalation",
    title: "Review risk escalation",
    badge: { tone: "danger", label: "Warning" },
    drawer: {
      title: "Supplier confirmation is still pending",
      why: "The migration window depends on confirmation before Friday.",
      evidence: ["Email from Alejandro, June 29", "Meeting note, June 26", "Task #104"],
      nextStep: "Draft a short follow-up asking for confirmation and a proposed window.",
    },
  },
  {
    id: "confirm-missing-evidence",
    title: "Confirm missing evidence",
    badge: { tone: "task", label: "Task" },
    drawer: {
      title: "Confirm missing evidence",
      why: "A commitment was logged without a source document attached, so it can't be verified yet.",
      evidence: ["Commitment logged, June 27", "No attached source"],
      nextStep: "Attach the source document or confirm the commitment manually.",
    },
  },
  {
    id: "review-project-brief",
    title: "Review project brief",
    badge: { tone: "insight", label: "Insight" },
    drawer: {
      title: "Review project brief",
      why: "A fresh brief has been prepared summarizing what changed this week and what needs attention.",
      evidence: ["Project plan v3", "Meeting note, June 26", "Task #104"],
      nextStep: "Read the brief and share it with stakeholders if it looks right.",
    },
  },
];

export const DEMO_AGENTS: Agent[] = [
  {
    id: "risk-sentinel",
    name: "Risk Sentinel",
    statusText: "Checking blockers...",
    badge: { tone: "danger", label: "2 warnings" },
    activity: "pulsing",
    drawer: {
      title: "Risk Sentinel",
      why: "Watches for blockers and delivery risks as new evidence comes in.",
      evidence: ["Email from Alejandro, June 29", "Meeting note, June 26"],
      nextStep: "Ask Risk Sentinel to summarize the current risk picture.",
    },
  },
  {
    id: "task-builder",
    name: "Task Builder",
    statusText: "Preparing next steps...",
    badge: { tone: "task", label: "3 tasks" },
    activity: "progress",
    drawer: {
      title: "Task Builder",
      why: "Turns decisions and open commitments into concrete next steps.",
      evidence: ["Task #104", "Project plan v3"],
      nextStep: "Review the drafted tasks before they're assigned.",
    },
  },
  {
    id: "commitment-tracker",
    name: "Commitment Tracker",
    statusText: "Watching open promises...",
    badge: { tone: "approval", label: "1 approval" },
    activity: "pulsing",
    drawer: {
      title: "Commitment Tracker",
      why: "Keeps track of promises made in meetings and emails so nothing slips.",
      evidence: ["Meeting note, June 26", "Email from Alejandro, June 29"],
      nextStep: "Confirm which open commitments are still on track.",
    },
  },
  {
    id: "document-librarian",
    name: "Document Librarian",
    statusText: "Indexing project files...",
    badge: { tone: "info", label: "12 sources" },
    activity: "shimmer",
    drawer: {
      title: "Document Librarian",
      why: "Keeps every document, email, and note organized and searchable.",
      evidence: ["18 documents", "42 emails", "9 meeting notes"],
      nextStep: "Ask what's in the project repository for a quick overview.",
    },
  },
  {
    id: "executive-briefing",
    name: "Executive Briefing",
    statusText: "Draft ready",
    badge: { tone: "task", label: "1 task" },
    activity: "idle",
    drawer: {
      title: "Executive Briefing",
      why: "Prepares a short, client-ready summary of project status.",
      evidence: ["Project plan v3", "Task #104"],
      nextStep: "Review the draft brief before sharing it.",
    },
  },
  {
    id: "governance-guard",
    name: "Governance Guard",
    statusText: "Waiting for approval",
    badge: { tone: "approval", label: "1 approval" },
    activity: "pulsing",
    drawer: {
      title: "Governance Guard",
      why: "Routes sensitive actions for human approval before anything is sent.",
      evidence: ["Draft client update, prepared today"],
      nextStep: "Approve or reject the pending action in Needs You.",
    },
  },
];

export const DEMO_CHAT: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "BNR-15959 is ready. I can help you review changes, spot risks, prepare updates, create tasks, or generate a project brief.",
  },
  {
    id: "user-1",
    role: "user",
    content: "What changed since yesterday?",
  },
  {
    id: "assistant-1",
    role: "assistant",
    content:
      "Three things need attention: supplier confirmation is still pending, two commitments are overdue, and one client-facing update is ready for review.",
    structuredList: [
      "Supplier confirmation is still pending.",
      "Two commitments are overdue.",
      "A client-facing update is ready for review.",
    ],
    sources: ["Email from Alejandro, June 29", "Meeting note, June 26", "Project plan v3", "Task #104"],
    suggestedActions: ["Draft update", "Create task", "Review risks", "Generate brief"],
  },
];

export const SUGGESTED_PROMPTS = [
  "What changed since yesterday?",
  "What risks need attention?",
  "Prepare a client update.",
];
