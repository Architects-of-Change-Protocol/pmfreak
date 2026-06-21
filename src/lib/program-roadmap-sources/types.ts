import type {
  ProgramRoadmapSourceRow,
  ProgramRoadmapSourceStatus,
  ProgramRoadmapSourceType,
} from "@/lib/db/database-contract";

export type { ProgramRoadmapSourceRow, ProgramRoadmapSourceStatus, ProgramRoadmapSourceType };

export type ProgramRoadmapSourceEventType =
  | "PROGRAM_ROADMAP_SOURCE_CREATED"
  | "PROGRAM_ROADMAP_SOURCE_UPDATED"
  | "PROGRAM_ROADMAP_SOURCE_ACTIVATED"
  | "PROGRAM_ROADMAP_SOURCE_ARCHIVED";

export type ProgramRoadmapSourceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type CreateProgramRoadmapSourceInput = {
  workspaceId: string;
  programId: string;
  rawText: string;
  sourceType: ProgramRoadmapSourceType;
  title?: string | null;
  status?: ProgramRoadmapSourceStatus;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type UpdateProgramRoadmapSourceInput = {
  rawText?: string;
  title?: string | null;
  status?: ProgramRoadmapSourceStatus;
  metadata?: Record<string, unknown> | null;
  actorId: string;
};

export const PROGRAM_ROADMAP_SOURCE_TYPES: ProgramRoadmapSourceType[] = [
  "TEXT",
  "MARKDOWN",
  "CLAUDE_PLAN",
  "AOC_PLAN",
  "INFRASTRUCTURE_PLAN",
  "CUSTOM",
];

export const PROGRAM_ROADMAP_SOURCE_STATUSES: ProgramRoadmapSourceStatus[] = [
  "DRAFT",
  "ACTIVE",
  "SUPERSEDED",
  "ARCHIVED",
];

export const RAW_TEXT_MAX_LENGTH = 500_000;
export const TITLE_MAX_LENGTH = 200;
