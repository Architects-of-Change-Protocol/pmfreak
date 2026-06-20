import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROGRAM_EPIC_SELECTABLE_COLUMNS, PROGRAM_SPRINT_SELECTABLE_COLUMNS, PROGRAM_CARD_SELECTABLE_COLUMNS } from "@/lib/db/database-contract";
import type { ProgramEpicRow, ProgramSprintRow, ProgramCardRow } from "@/lib/db/database-contract";
import { dbFindProgramById } from "./program-repository";
import type { ProgramRow } from "./types";
import type { ProgramResult } from "./types";

export type ProgramTreeSprintNode = {
  sprint: ProgramSprintRow;
  cards: ProgramCardRow[];
};

export type ProgramTreeEpicNode = {
  epic: ProgramEpicRow;
  sprints: ProgramTreeSprintNode[];
  cards: ProgramCardRow[];
};

export type ProgramTree = {
  program: ProgramRow;
  epics: ProgramTreeEpicNode[];
};

export async function getProgramTree(
  programId: string,
  workspaceId: string
): Promise<ProgramResult<ProgramTree>> {
  if (!programId || !workspaceId) {
    return { ok: false, error: "programId and workspaceId are required.", failureClass: "validation_failed" };
  }

  const programResult = await dbFindProgramById(programId, workspaceId);
  if (!programResult.ok) return programResult;

  const supabase = await createSupabaseServerClient();

  const epicCols = PROGRAM_EPIC_SELECTABLE_COLUMNS.join(",");
  const sprintCols = PROGRAM_SPRINT_SELECTABLE_COLUMNS.join(",");
  const cardCols = PROGRAM_CARD_SELECTABLE_COLUMNS.join(",");

  const [epicsRes, sprintsRes, cardsRes] = await Promise.all([
    supabase
      .from("program_epics")
      .select(epicCols)
      .eq("program_id", programId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("program_sprints")
      .select(sprintCols)
      .eq("program_id", programId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
    supabase
      .from("program_cards")
      .select(cardCols)
      .eq("program_id", programId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("order_index", { ascending: true }),
  ]);

  if (epicsRes.error) return { ok: false, error: "Unable to load epics.", failureClass: "persistence_failed" };
  if (sprintsRes.error) return { ok: false, error: "Unable to load sprints.", failureClass: "persistence_failed" };
  if (cardsRes.error) return { ok: false, error: "Unable to load cards.", failureClass: "persistence_failed" };

  const epics = (epicsRes.data ?? []) as unknown as ProgramEpicRow[];
  const sprints = (sprintsRes.data ?? []) as unknown as ProgramSprintRow[];
  const cards = (cardsRes.data ?? []) as unknown as ProgramCardRow[];

  const epicNodes: ProgramTreeEpicNode[] = epics.map((epic) => {
    const epicSprints = sprints.filter((s) => s.epic_id === epic.id);
    const sprintNodes: ProgramTreeSprintNode[] = epicSprints.map((sprint) => ({
      sprint,
      cards: cards.filter((c) => c.sprint_id === sprint.id),
    }));
    return {
      epic,
      sprints: sprintNodes,
      cards: cards.filter((c) => c.epic_id === epic.id && c.sprint_id === null),
    };
  });

  return {
    ok: true,
    data: {
      program: programResult.data,
      epics: epicNodes,
    },
  };
}
