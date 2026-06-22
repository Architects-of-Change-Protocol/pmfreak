import type { ProgramBoardColumn, ProgramCardRow } from "@/lib/db/database-contract";

export type { ProgramBoardColumn, ProgramCardRow };

export type ProgramBoardResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type ProgramBoardStats = {
  totalCards: number;
  backlogCount: number;
  readyCount: number;
  inProgressCount: number;
  inReviewCount: number;
  doneCount: number;
  completionPercentage: number;
};

export type ProgramExecutionBoard = {
  backlog: ProgramCardRow[];
  ready: ProgramCardRow[];
  inProgress: ProgramCardRow[];
  inReview: ProgramCardRow[];
  done: ProgramCardRow[];
  stats: ProgramBoardStats;
};

export type ProgramBoardEventType =
  | "PROGRAM_BOARD_VIEWED"
  | "PROGRAM_CARD_MOVED"
  | "PROGRAM_CARD_READY"
  | "PROGRAM_CARD_STARTED"
  | "PROGRAM_CARD_REVIEWED"
  | "PROGRAM_CARD_COMPLETED"
  | "PROGRAM_CARD_REOPENED";

export const PROGRAM_BOARD_COLUMNS: ProgramBoardColumn[] = [
  "BACKLOG",
  "READY",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const VALID_TRANSITIONS: Record<ProgramBoardColumn, ProgramBoardColumn[]> = {
  BACKLOG: ["READY"],
  READY: ["BACKLOG", "IN_PROGRESS"],
  IN_PROGRESS: ["READY", "IN_REVIEW"],
  IN_REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["IN_PROGRESS"],
};

export function resolveMovedEventType(target: ProgramBoardColumn, from: ProgramBoardColumn): ProgramBoardEventType {
  if (target === "READY") return "PROGRAM_CARD_READY";
  if (target === "IN_PROGRESS" && from === "DONE") return "PROGRAM_CARD_REOPENED";
  if (target === "IN_PROGRESS") return "PROGRAM_CARD_STARTED";
  if (target === "IN_REVIEW") return "PROGRAM_CARD_REVIEWED";
  if (target === "DONE") return "PROGRAM_CARD_COMPLETED";
  return "PROGRAM_CARD_MOVED";
}
