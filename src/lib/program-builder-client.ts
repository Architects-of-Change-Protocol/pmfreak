import type {
  ProgramRow,
  ProgramType,
  ProgramRoadmapSourceRow,
  ProgramRoadmapSourceType,
  ProgramRoadmapSourceStatus,
  ProgramRoadmapParseResultRow,
  ProgramBoardColumn,
  ProgramCardRow,
  ProgramCardMaterializationType,
} from "@/lib/db/database-contract";
import type { ProgramRoadmapParseResult } from "@/lib/program-roadmap-parser/types";

export type { ProgramRow, ProgramType, ProgramRoadmapSourceRow, ProgramRoadmapParseResultRow, ProgramBoardColumn, ProgramCardRow, ProgramCardMaterializationType };

export type ProgramCardContext = {
  epic?: {
    id: string;
    number: number;
    title: string;
  };
  sprint?: {
    id: string;
    number: number;
    title: string;
    objective?: string | null;
  };
  source?: {
    id: string;
    title?: string | null;
    sourceType: string;
    version: number;
  };
  materialization?: {
    id: string;
    parseResultId: string;
    createdAt: string;
  };
  origin?: {
    materializationType?: ProgramCardMaterializationType | null;
    materializationSource?: string | null;
    sourceLineNumber?: number | null;
  };
};

export type ProgramBoardCard = ProgramCardRow & {
  context: ProgramCardContext;
};

export type ProgramExecutionBoard = {
  backlog: ProgramBoardCard[];
  ready: ProgramBoardCard[];
  inProgress: ProgramBoardCard[];
  inReview: ProgramBoardCard[];
  done: ProgramBoardCard[];
  stats: {
    totalCards: number;
    backlogCount: number;
    readyCount: number;
    inProgressCount: number;
    inReviewCount: number;
    doneCount: number;
    completionPercentage: number;
  };
};

export type CreateProgramInput = {
  name: string;
  description?: string | null;
  type: ProgramType;
};

export type CreateRoadmapSourceInput = {
  rawText: string;
  sourceType: ProgramRoadmapSourceType;
  title?: string | null;
  status?: ProgramRoadmapSourceStatus;
};

export type ParseResponse = {
  parseResult: ProgramRoadmapParseResultRow;
  parsed: ProgramRoadmapParseResult;
};

export type MaterializeResponse = {
  materializationId: string;
  epicsCreated: number;
  sprintsCreated: number;
  cardsCreated: number;
  skippedCards: number;
  warnings: string[];
  createdEntities: unknown[];
};

export type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function apiFetch<T>(url: string, options?: RequestInit): Promise<ClientResult<T>> {
  try {
    const res = await fetch(url, { ...options, cache: "no-store" });
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error ?? "Request failed.", status: res.status };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function listPrograms(): Promise<ClientResult<{ programs: ProgramRow[] }>> {
  return apiFetch("/api/programs");
}

export async function createProgram(input: CreateProgramInput): Promise<ClientResult<{ program: ProgramRow }>> {
  return apiFetch("/api/programs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getProgram(programId: string): Promise<ClientResult<{ program: ProgramRow }>> {
  return apiFetch(`/api/programs/${programId}`);
}

export async function createRoadmapSource(
  programId: string,
  input: CreateRoadmapSourceInput
): Promise<ClientResult<{ roadmapSource: ProgramRoadmapSourceRow }>> {
  return apiFetch(`/api/programs/${programId}/roadmap-sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getActiveRoadmapSource(
  programId: string
): Promise<ClientResult<{ roadmapSource: ProgramRoadmapSourceRow | null }>> {
  const result = await apiFetch<{ roadmapSources: ProgramRoadmapSourceRow[] }>(
    `/api/programs/${programId}/roadmap-sources`
  );
  if (!result.ok) return result;
  const active = result.data.roadmapSources.find((s) => s.status === "ACTIVE") ?? null;
  return { ok: true, data: { roadmapSource: active } };
}

export async function parseRoadmapSource(
  programId: string,
  sourceId: string
): Promise<ClientResult<ParseResponse>> {
  return apiFetch(`/api/programs/${programId}/roadmap-sources/${sourceId}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function materializeProgram(
  programId: string,
  parseResultId: string
): Promise<ClientResult<MaterializeResponse>> {
  return apiFetch(`/api/programs/${programId}/materialize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parseResultId }),
  });
}

export async function getExecutionBoard(
  programId: string
): Promise<ClientResult<ProgramExecutionBoard>> {
  return apiFetch(`/api/programs/${programId}/board`);
}

export async function moveProgramCard(
  programId: string,
  cardId: string,
  targetColumn: ProgramBoardColumn
): Promise<ClientResult<{ success: boolean }>> {
  return apiFetch(`/api/programs/${programId}/cards/${cardId}/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetColumn }),
  });
}
