import type { ProgramSprintRow, ProgramItemStatus } from "@/lib/db/database-contract";

export type { ProgramSprintRow, ProgramItemStatus };

export type ProgramSprintEventType =
  | "PROGRAM_SPRINT_CREATED"
  | "PROGRAM_SPRINT_UPDATED"
  | "PROGRAM_SPRINT_ARCHIVED";

export type ProgramSprintResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type CreateProgramSprintInput = {
  workspaceId: string;
  programId: string;
  epicId: string;
  number: number;
  title: string;
  description?: string | null;
  objective?: string | null;
  status?: ProgramItemStatus;
  orderIndex: number;
  actorId: string;
};

export type UpdateProgramSprintInput = {
  title?: string;
  description?: string | null;
  objective?: string | null;
  status?: ProgramItemStatus;
  orderIndex?: number;
  actorId: string;
};
