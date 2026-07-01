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
  /** True only once real project intelligence (a governance brief) has been evaluated and found no issues. */
  healthy?: boolean;
  /** Whether a governance brief has been evaluated for this project yet. False means "unknown", not "healthy". */
  hasIntelligence?: boolean;
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

export type DrawerAction = {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export type DrawerContent = {
  title: string;
  why: string;
  evidence: string[];
  nextStep: string;
  /** Real actions (e.g. Accept/Reject/Defer a recommendation). Falls back to static example buttons when omitted. */
  actions?: DrawerAction[];
  /** e.g. "Requires an authorized decision-maker for: ..." shown below the actions. */
  note?: string;
};

export type NeedsYouItem = {
  id: string;
  title: string;
  badge: ToneBadge;
  drawer: DrawerContent;
  /** Present when this item is backed by a real operational-flow recommendation awaiting a decision. */
  recommendationId?: string;
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
