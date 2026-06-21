import type { ProgramCardMaterializationType, ProgramCardRow, ProgramCardType, ProgramItemStatus } from "@/lib/db/database-contract";

export type { ProgramCardMaterializationType, ProgramCardRow, ProgramCardType, ProgramItemStatus };

export type ProgramCardEventType =
  | "PROGRAM_CARD_CREATED"
  | "PROGRAM_CARD_UPDATED"
  | "PROGRAM_CARD_ARCHIVED";

export type ProgramCardResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type CreateProgramCardInput = {
  workspaceId: string;
  programId: string;
  epicId?: string | null;
  sprintId?: string | null;
  title: string;
  description?: string | null;
  promptBody?: string | null;
  type: ProgramCardType;
  status?: ProgramItemStatus;
  orderIndex: number;
  actorId: string;
};

export type UpdateProgramCardInput = {
  title?: string;
  description?: string | null;
  promptBody?: string | null;
  status?: ProgramItemStatus;
  orderIndex?: number;
  actorId: string;
};

export const PROGRAM_CARD_TYPES: ProgramCardType[] = [
  "EPIC",
  "SPRINT",
  "TASK",
  "PROMPT",
  "MILESTONE",
  "DELIVERABLE",
  "CUSTOM",
];

export const PROGRAM_ITEM_STATUSES_CARDS = [
  "DRAFT",
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "ARCHIVED",
] as const;
