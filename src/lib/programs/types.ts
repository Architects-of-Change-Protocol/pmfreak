import type { ProgramRow, ProgramStatus, ProgramType } from "@/lib/db/database-contract";

export type { ProgramRow, ProgramStatus, ProgramType };

export type ProgramEventType =
  | "PROGRAM_CREATED"
  | "PROGRAM_UPDATED"
  | "PROGRAM_ARCHIVED"
  | "PROGRAM_STATUS_CHANGED";

export type ProgramResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type CreateProgramInput = {
  workspaceId: string;
  name: string;
  description?: string | null;
  type: ProgramType;
  ownerId: string;
};

export type UpdateProgramInput = {
  name?: string;
  description?: string | null;
  status?: ProgramStatus;
  startDate?: string | null;
  targetDate?: string | null;
  actorId: string;
};

export type ProgramExplanation = {
  id: string;
  name: string;
  type: ProgramType;
  status: ProgramStatus;
  owner: string | null;
  createdAt: string;
  summary: string;
};

export const PROGRAM_TYPES: ProgramType[] = [
  "SOFTWARE_DEVELOPMENT",
  "INFRASTRUCTURE_PROJECT",
  "CUSTOMER_ONBOARDING",
  "AOC_PROTOCOL_ADOPTION",
  "ORGANIZATIONAL_CHANGE",
  "STRATEGIC_INITIATIVE",
  "INTERNAL_PROGRAM",
  "CUSTOM",
];

export const PROGRAM_STATUSES: ProgramStatus[] = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
];
