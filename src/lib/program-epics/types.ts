import type { ProgramEpicRow, ProgramItemStatus } from "@/lib/db/database-contract";

export type { ProgramEpicRow, ProgramItemStatus };

export type ProgramEpicEventType =
  | "PROGRAM_EPIC_CREATED"
  | "PROGRAM_EPIC_UPDATED"
  | "PROGRAM_EPIC_ARCHIVED";

export type ProgramEpicResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type CreateProgramEpicInput = {
  workspaceId: string;
  programId: string;
  number: number;
  title: string;
  description?: string | null;
  status?: ProgramItemStatus;
  orderIndex: number;
  actorId: string;
};

export type UpdateProgramEpicInput = {
  title?: string;
  description?: string | null;
  status?: ProgramItemStatus;
  orderIndex?: number;
  actorId: string;
};

export const PROGRAM_ITEM_STATUSES: ProgramItemStatus[] = [
  "DRAFT",
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "ARCHIVED",
];
