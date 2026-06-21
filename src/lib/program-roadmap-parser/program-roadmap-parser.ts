import type {
  ParsedProgramEpic,
  ParsedProgramSprint,
  ProgramRoadmapParseError,
  ProgramRoadmapParseErrorCode,
  ProgramRoadmapParseResult,
  ProgramRoadmapParseStats,
  ProgramRoadmapParseWarning,
  ProgramRoadmapParseWarningCode,
} from "./types";

const EPIC_RE = /^EPIC\s+(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
const SPRINT_RE = /^Sprint\s+(\d+)\s*(?:—|-|:)?\s*(.*)$/i;

function warn(
  code: ProgramRoadmapParseWarningCode,
  message: string,
  line?: number,
  context?: string
): ProgramRoadmapParseWarning {
  return { code, message, ...(line !== undefined ? { line } : {}), ...(context !== undefined ? { context } : {}) };
}

function parseError(
  code: ProgramRoadmapParseErrorCode,
  message: string,
  line?: number,
  context?: string
): ProgramRoadmapParseError {
  return { code, message, ...(line !== undefined ? { line } : {}), ...(context !== undefined ? { context } : {}) };
}

function resolveStatus(errors: ProgramRoadmapParseError[], warnings: ProgramRoadmapParseWarning[]) {
  if (errors.length > 0) return "INVALID" as const;
  if (warnings.length > 0) return "VALID_WITH_WARNINGS" as const;
  return "VALID" as const;
}

export function parseProgramRoadmapText(input: {
  programId: string;
  sourceId: string;
  rawText: string;
}): ProgramRoadmapParseResult {
  const parsedAt = new Date();
  const warnings: ProgramRoadmapParseWarning[] = [];
  const errors: ProgramRoadmapParseError[] = [];

  const trimmed = input.rawText.trim();
  if (!trimmed) {
    errors.push(parseError("SOURCE_EMPTY", "The roadmap source is empty."));
    const lines = input.rawText.split("\n");
    return {
      programId: input.programId,
      sourceId: input.sourceId,
      parsedAt,
      status: "INVALID",
      epics: [],
      warnings,
      errors,
      stats: {
        totalLines: lines.length,
        epicCount: 0,
        sprintCount: 0,
        emptyLineCount: lines.filter(l => !l.trim()).length,
        unassignedSprintCount: 0,
        duplicateEpicNumberCount: 0,
        duplicateSprintNumberCount: 0,
      },
    };
  }

  const lines = input.rawText.split("\n");
  const totalLines = lines.length;
  let emptyLineCount = 0;
  let duplicateEpicNumberCount = 0;
  let duplicateSprintNumberCount = 0;
  let unassignedSprintCount = 0;

  const seenEpicNumbers = new Set<number>();
  const seenSprintNumbers = new Set<number>();

  // Build mutable epic/sprint structures with placeholder endLine
  type EpicDraft = ParsedProgramEpic & { _endLine: number };
  type SprintDraft = ParsedProgramSprint & { _endLine: number };

  const epicDrafts: (Omit<EpicDraft, "sprints"> & { sprints: SprintDraft[] })[] = [];
  let currentEpic: (typeof epicDrafts)[0] | null = null;

  // Flat ordered list of heading line indices for endLine computation
  type Heading =
    | { kind: "epic"; draft: (typeof epicDrafts)[0] }
    | { kind: "sprint"; draft: SprintDraft };
  const headings: Heading[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    if (!line.trim()) {
      emptyLineCount++;
      continue;
    }

    const epicMatch = EPIC_RE.exec(line);
    if (epicMatch) {
      const number = parseInt(epicMatch[1], 10);
      const title = (epicMatch[2] ?? "").trim();

      if (seenEpicNumbers.has(number)) {
        duplicateEpicNumberCount++;
        errors.push(parseError("DUPLICATE_EPIC_NUMBER", `Duplicate epic number ${number}.`, lineNum, line));
      } else {
        seenEpicNumbers.add(number);
        const draft = {
          number,
          title,
          rawHeading: line,
          startLine: lineNum,
          endLine: totalLines, // placeholder
          _endLine: totalLines,
          sprints: [] as SprintDraft[],
        };
        epicDrafts.push(draft);
        headings.push({ kind: "epic", draft });
        currentEpic = draft;
      }
      continue;
    }

    const sprintMatch = SPRINT_RE.exec(line);
    if (sprintMatch) {
      const number = parseInt(sprintMatch[1], 10);
      const title = (sprintMatch[2] ?? "").trim();

      if (!currentEpic) {
        unassignedSprintCount++;
        errors.push(parseError("SPRINT_WITHOUT_EPIC", `Sprint ${number} appears before any Epic.`, lineNum, line));
        continue;
      }

      if (!title) {
        warnings.push(warn("SPRINT_TITLE_MISSING", `Sprint ${number} has no title.`, lineNum, line));
      }

      if (seenSprintNumbers.has(number)) {
        duplicateSprintNumberCount++;
        errors.push(parseError("DUPLICATE_SPRINT_NUMBER", `Duplicate sprint number ${number}.`, lineNum, line));
      } else {
        seenSprintNumbers.add(number);
        const draft: SprintDraft = {
          number,
          title,
          rawHeading: line,
          startLine: lineNum,
          endLine: totalLines,
          _endLine: totalLines,
          epicNumber: currentEpic.number,
        };
        currentEpic.sprints.push(draft);
        headings.push({ kind: "sprint", draft });
      }
      continue;
    }
  }

  // Epic endLine: line before the next epic, or totalLines.
  // Sprint endLine: line before the next sprint or next epic, or totalLines.
  for (let hi = 0; hi < headings.length; hi++) {
    const h = headings[hi];
    if (h.kind === "epic") {
      // Find the next epic heading
      let nextEpicStart = totalLines;
      for (let j = hi + 1; j < headings.length; j++) {
        if (headings[j].kind === "epic") { nextEpicStart = headings[j].draft.startLine - 1; break; }
      }
      h.draft.endLine = nextEpicStart;
    } else {
      // Sprint: ends before the next sprint or next epic
      h.draft.endLine =
        hi < headings.length - 1
          ? headings[hi + 1].draft.startLine - 1
          : totalLines;
    }
  }

  // Validate: no epics
  if (epicDrafts.length === 0) {
    errors.push(parseError("NO_EPICS_FOUND", "No epics found in the roadmap source."));
  }

  // Warnings: epics without sprints, non-sequential epic numbers
  let prevEpicNum = 0;
  const epics: ParsedProgramEpic[] = [];

  for (const d of epicDrafts) {
    if (d.sprints.length === 0) {
      warnings.push(warn("EPIC_WITHOUT_SPRINTS", `Epic ${d.number} has no sprints.`, d.startLine, d.rawHeading));
    }
    if (prevEpicNum > 0 && d.number > prevEpicNum + 1) {
      warnings.push(warn("NON_SEQUENTIAL_EPIC_NUMBER", `Epic number ${d.number} is not sequential after ${prevEpicNum}.`, d.startLine, d.rawHeading));
    }
    prevEpicNum = d.number;

    let prevSprintNum = 0;
    const sprints: ParsedProgramSprint[] = [];
    for (const s of d.sprints) {
      if (prevSprintNum > 0 && s.number > prevSprintNum + 1) {
        warnings.push(warn("NON_SEQUENTIAL_SPRINT_NUMBER", `Sprint number ${s.number} is not sequential after ${prevSprintNum}.`, s.startLine, s.rawHeading));
      }
      prevSprintNum = s.number;
      sprints.push({
        number: s.number,
        title: s.title,
        rawHeading: s.rawHeading,
        startLine: s.startLine,
        endLine: s.endLine,
        epicNumber: s.epicNumber,
      });
    }

    epics.push({
      number: d.number,
      title: d.title,
      rawHeading: d.rawHeading,
      startLine: d.startLine,
      endLine: d.endLine,
      sprints,
    });
  }

  const stats: ProgramRoadmapParseStats = {
    totalLines,
    epicCount: epics.length,
    sprintCount: epics.reduce((acc, e) => acc + e.sprints.length, 0),
    emptyLineCount,
    unassignedSprintCount,
    duplicateEpicNumberCount,
    duplicateSprintNumberCount,
  };

  return {
    programId: input.programId,
    sourceId: input.sourceId,
    parsedAt,
    status: resolveStatus(errors, warnings),
    epics,
    warnings,
    errors,
    stats,
  };
}
