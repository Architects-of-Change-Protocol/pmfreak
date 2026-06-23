import type {
  OperationalCommandCenterRow,
  OperationalFocusItemRow,
  OperationalFocusLinkRow,
  OperationalCommandStatus,
  OperationalPriority,
  OperationalFocusType,
  OperationalFocusStatus,
} from "@/lib/db/database-contract";

export type {
  OperationalCommandCenterRow,
  OperationalFocusItemRow,
  OperationalFocusLinkRow,
  OperationalCommandStatus,
  OperationalPriority,
  OperationalFocusType,
  OperationalFocusStatus,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const OPERATIONAL_COMMAND_STATUSES: OperationalCommandStatus[] = [
  "generated",
  "validated",
  "archived",
];

export const OPERATIONAL_PRIORITIES: OperationalPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const OPERATIONAL_FOCUS_TYPES: OperationalFocusType[] = [
  "governance",
  "execution",
  "authority",
  "ratification",
  "recommendation",
  "commitment",
  "projection",
  "reality",
  "risk",
  "health",
];

export const OPERATIONAL_FOCUS_STATUSES: OperationalFocusStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "dismissed",
];

// ─── Result Type ──────────────────────────────────────────────────────────────

export type CommandCenterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

// ─── Event Types ──────────────────────────────────────────────────────────────

export type CommandCenterEventType =
  | "OPERATIONAL_COMMAND_CENTER_GENERATED"
  | "OPERATIONAL_COMMAND_CENTER_VALIDATED"
  | "OPERATIONAL_COMMAND_CENTER_ARCHIVED"
  | "OPERATIONAL_FOCUS_ITEM_CREATED"
  | "OPERATIONAL_FOCUS_ITEM_ACKNOWLEDGED"
  | "OPERATIONAL_FOCUS_ITEM_STARTED"
  | "OPERATIONAL_FOCUS_ITEM_RESOLVED"
  | "OPERATIONAL_FOCUS_ITEM_DISMISSED"
  | "OPERATIONAL_FOCUS_SCORE_CALCULATED"
  | "OPERATIONAL_PRIORITY_CALCULATED"
  | "OPERATIONAL_FOCUS_LINEAGE_GENERATED";

// ─── Generated Focus Item (runtime, before persistence) ───────────────────────

export type GeneratedFocusItem = {
  attentionItemId: string | null;
  focusType: OperationalFocusType;
  priority: OperationalPriority;
  focusScore: number;
  title: string;
  description: string;
  rationale: string;
  recommendedActionType: string | null;
  recommendedOwnerType: string | null;
  recommendedDueDate: string | null;
};

// ─── Command Center Health ────────────────────────────────────────────────────

export type CommandCenterHealth = {
  openFocusItems: number;
  criticalFocusItems: number;
  resolvedFocusItems: number;
  averageFocusScore: number;
  overallPriority: OperationalPriority;
};

// ─── Operational Focus (rich summary) ────────────────────────────────────────

export type OperationalFocus = {
  commandCenterId: string;
  projectId: string;
  workspaceId: string;
  topFocusItems: OperationalFocusItemRow[];
  criticalBlockers: OperationalFocusItemRow[];
  overdueItems: OperationalFocusItemRow[];
  recommendedInterventions: Array<{
    focusItemId: string;
    title: string;
    recommendedActionType: string | null;
    recommendedOwnerType: string | null;
    recommendedDueDate: string | null;
    priority: OperationalPriority;
  }>;
};

// ─── Lineage ──────────────────────────────────────────────────────────────────

export type CommandCenterLineageLayer = {
  layer:
    | "constitution"
    | "memory"
    | "learning"
    | "recommendation"
    | "signal"
    | "action"
    | "commitment"
    | "projection"
    | "reality"
    | "snapshot"
    | "command_center"
    | "focus_item";
  entityType: string;
  entityId: string | null;
  label: string;
  count: number;
};

export type CommandCenterLineage = {
  projectId: string;
  workspaceId: string;
  commandCenterId: string;
  chain: CommandCenterLineageLayer[];
  generatedAt: string;
};

// ─── Service Input Types ──────────────────────────────────────────────────────

export type GenerateCommandCenterInput = {
  workspaceId: string;
  projectId: string;
  snapshotId: string;
  actorId: string;
};

export type GetCommandCenterInput = {
  workspaceId: string;
  commandCenterId: string;
};

export type ListCommandCentersInput = {
  workspaceId: string;
  projectId?: string;
  snapshotId?: string;
  status?: OperationalCommandStatus;
  priority?: OperationalPriority;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type ValidateCommandCenterInput = {
  workspaceId: string;
  commandCenterId: string;
  actorId: string;
};

export type ArchiveCommandCenterInput = {
  workspaceId: string;
  commandCenterId: string;
  actorId: string;
};

export type AcknowledgeFocusItemInput = {
  workspaceId: string;
  focusItemId: string;
  actorId: string;
};

export type StartFocusItemInput = {
  workspaceId: string;
  focusItemId: string;
  actorId: string;
};

export type ResolveFocusItemInput = {
  workspaceId: string;
  focusItemId: string;
  actorId: string;
};

export type DismissFocusItemInput = {
  workspaceId: string;
  focusItemId: string;
  actorId: string;
};

export type GetOperationalFocusInput = {
  workspaceId: string;
  commandCenterId: string;
};

export type GetCommandCenterLineageInput = {
  workspaceId: string;
  commandCenterId: string;
  actorId: string;
};

export type ExplainCommandCenterInput = {
  workspaceId: string;
  commandCenterId: string;
};
