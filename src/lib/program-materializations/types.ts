import type {
  ProgramMaterializationRow,
  ProgramMaterializationStatus,
} from "@/lib/db/database-contract";

export type { ProgramMaterializationRow, ProgramMaterializationStatus };

export type ProgramMaterializationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type ProgramMaterializationReport = {
  epicsCreated: number;
  sprintsCreated: number;
  cardsCreated: number;
  skippedCards: number;
  warnings: string[];
  createdEntities: {
    epicIds: string[];
    sprintIds: string[];
    cardIds: string[];
  };
};

export type MaterializeEpicPlan = {
  number: number;
  title: string;
  orderIndex: number;
};

export type MaterializeSprintPlan = {
  number: number;
  epicNumber: number;
  title: string;
  objective: string | null;
  orderIndex: number;
};

export type MaterializeCardPlan = {
  sprintNumber: number;
  epicNumber: number;
  title: string;
  type: "TASK" | "DELIVERABLE";
  materializationType: "CAPABILITY" | "DELIVERABLE";
  sourceLineNumber: number | null;
  orderIndex: number;
};

export type MaterializationPlan = {
  epics: MaterializeEpicPlan[];
  sprints: MaterializeSprintPlan[];
  cards: MaterializeCardPlan[];
  warnings: string[];
};

export type MaterializeProgramRoadmapInput = {
  workspaceId: string;
  programId: string;
  parseResultId: string;
  actorId: string;
};
