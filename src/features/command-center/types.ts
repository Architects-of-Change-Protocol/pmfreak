export type StatusTone = "danger" | "task" | "approval" | "insight" | "success" | "info";

export type ToneBadge = {
  tone: StatusTone;
  label: string;
};

export type ProjectListItem = {
  id: string;
  code: string;
  name: string;
  fullName: string;
  badges: ToneBadge[];
  healthy?: boolean;
};

export type RepositoryItem = {
  id: string;
  label: string;
  icon: "document" | "mail" | "notes" | "chat" | "attachment" | "decision" | "commitment" | "evidence";
  count?: number;
};

export type MemoryItem = {
  id: string;
  label: string;
};

export type DrawerContent = {
  title: string;
  why: string;
  evidence: string[];
  nextStep: string;
};

export type NeedsYouItem = {
  id: string;
  title: string;
  badge: ToneBadge;
  drawer: DrawerContent;
};

export type AgentActivity = "pulsing" | "shimmer" | "progress" | "idle";

export type Agent = {
  id: string;
  name: string;
  statusText: string;
  badge: ToneBadge;
  activity: AgentActivity;
  drawer: DrawerContent;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  structuredList?: string[];
  sources?: string[];
  suggestedActions?: string[];
};

export type TopBarStat = {
  label: string;
  tone: StatusTone;
};
