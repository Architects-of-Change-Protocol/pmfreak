import type {
  ParsedProgramEpic,
  ParsedProgramPrompt,
  ParsedProgramSprint,
  PromptSections,
  PromptStats,
  PromptUnknownSection,
  ProgramRoadmapParseError,
  ProgramRoadmapParseErrorCode,
  ProgramRoadmapParseResult,
  ProgramRoadmapParseStats,
  ProgramRoadmapParseWarning,
  ProgramRoadmapParseWarningCode,
} from "./types";

const EPIC_RE = /^EPIC\s+(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
const SPRINT_RE = /^Sprint\s+(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
const PROMPT_RE = /^Prompt\s*:?\s*$/i;
const ALL_CAPS_SECTION_RE = /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]+$/;
const MAX_PROMPT_CHARS = 100_000;

const KNOWN_SECTION_MAP: Record<string, keyof PromptSections> = {
  objetivo: "objective",
  capacidades: "capabilities",
  entregables: "deliverables",
  reglas: "rules",
  notas: "notes",
};

function classifyLine(line: string): { type: "known"; key: keyof PromptSections } | { type: "unknown" } | null {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  if (KNOWN_SECTION_MAP[lower]) return { type: "known", key: KNOWN_SECTION_MAP[lower] };
  if (ALL_CAPS_SECTION_RE.test(trimmed) && trimmed.length >= 3) return { type: "unknown" };
  return null;
}

function parsePromptSections(bodyLines: string[]): { sections: PromptSections; sectionCount: number } {
  const sections: PromptSections = {
    capabilities: [],
    deliverables: [],
    rules: [],
    notes: [],
    unknownSections: [],
  };

  let currentSection: keyof PromptSections | "unknown" | null = null;
  let currentUnknownTitle = "";
  let currentUnknownLines: string[] = [];
  const objectiveLines: string[] = [];
  let sectionCount = 0;

  function flushUnknown() {
    if (currentUnknownTitle) {
      sections.unknownSections.push({
        title: currentUnknownTitle,
        content: currentUnknownLines.join("\n").trim(),
      } as PromptUnknownSection);
      currentUnknownTitle = "";
      currentUnknownLines = [];
    }
  }

  for (const raw of bodyLines) {
    const classification = classifyLine(raw);
    if (classification) {
      flushUnknown();
      sectionCount++;
      if (classification.type === "known") {
        currentSection = classification.key;
      } else {
        currentSection = "unknown";
        currentUnknownTitle = raw.trim();
      }
      continue;
    }

    const trimmed = raw.trim();

    if (currentSection === null || !trimmed) {
      if (currentSection === "unknown" && !trimmed) currentUnknownLines.push("");
      continue;
    }

    if (currentSection === "objective") {
      objectiveLines.push(trimmed);
    } else if (currentSection === "capabilities" || currentSection === "deliverables" || currentSection === "rules") {
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        (sections[currentSection] as string[]).push(trimmed.replace(/^[-*]\s*/, ""));
      }
    } else if (currentSection === "notes") {
      sections.notes.push(trimmed);
    } else if (currentSection === "unknown") {
      currentUnknownLines.push(raw);
    }
  }

  flushUnknown();

  if (objectiveLines.length > 0) {
    sections.objective = objectiveLines.join(" ");
  }

  return { sections, sectionCount };
}

function extractPrompt(
  lines: string[],
  sprintStartLine: number,
  sprintEndLine: number,
  sprintLineForWarning: number,
): { prompt: ParsedProgramPrompt; warnings: ProgramRoadmapParseWarning[] } | { prompt: null; warnings: ProgramRoadmapParseWarning[] } {
  const collectedWarnings: ProgramRoadmapParseWarning[] = [];

  let promptHeadingIdx = -1;
  for (let i = sprintStartLine; i <= sprintEndLine - 1; i++) {
    if (PROMPT_RE.test(lines[i].trim())) {
      promptHeadingIdx = i;
      break;
    }
  }

  if (promptHeadingIdx === -1) {
    collectedWarnings.push(warn("SPRINT_WITHOUT_PROMPT", "Sprint has no Prompt section.", sprintLineForWarning));
    return { prompt: null, warnings: collectedWarnings };
  }

  const rawHeading = lines[promptHeadingIdx];
  const promptStartLine = promptHeadingIdx + 2; // 1-based line after heading
  const bodyLines = lines.slice(promptHeadingIdx + 1, sprintEndLine);
  const body = bodyLines.join("\n").trim();

  if (!body) {
    collectedWarnings.push(warn("EMPTY_PROMPT", "Sprint Prompt is empty.", promptHeadingIdx + 1, rawHeading));
    const emptyPrompt: ParsedProgramPrompt = {
      rawHeading,
      body: "",
      startLine: promptHeadingIdx + 1,
      endLine: sprintEndLine,
      characterCount: 0,
      lineCount: 0,
      sections: { capabilities: [], deliverables: [], rules: [], notes: [], unknownSections: [] },
      stats: { sectionCount: 0, capabilityCount: 0, deliverableCount: 0, ruleCount: 0, noteCount: 0, characterCount: 0, lineCount: 0 },
    };
    return { prompt: emptyPrompt, warnings: collectedWarnings };
  }

  if (body.length > MAX_PROMPT_CHARS) {
    collectedWarnings.push(warn("PROMPT_TOO_LARGE", `Prompt exceeds ${MAX_PROMPT_CHARS} characters.`, promptHeadingIdx + 1));
  }

  const { sections, sectionCount } = parsePromptSections(bodyLines);

  if (!sections.objective) {
    collectedWarnings.push(warn("OBJECTIVE_MISSING", "Prompt has no OBJETIVO section.", promptHeadingIdx + 1));
  }
  if (sections.capabilities.length === 0) {
    collectedWarnings.push(warn("CAPABILITIES_MISSING", "Prompt has no CAPACIDADES section.", promptHeadingIdx + 1));
  }
  if (sections.deliverables.length === 0) {
    collectedWarnings.push(warn("DELIVERABLES_MISSING", "Prompt has no ENTREGABLES section.", promptHeadingIdx + 1));
  }
  if (sections.rules.length === 0) {
    collectedWarnings.push(warn("RULES_MISSING", "Prompt has no REGLAS section.", promptHeadingIdx + 1));
  }
  for (const unknown of sections.unknownSections) {
    collectedWarnings.push(warn("UNKNOWN_SECTION", `Unknown prompt section: ${unknown.title}.`, promptHeadingIdx + 1, unknown.title));
  }

  const bodyLineCount = bodyLines.filter(l => l.trim()).length;
  const stats: PromptStats = {
    sectionCount,
    capabilityCount: sections.capabilities.length,
    deliverableCount: sections.deliverables.length,
    ruleCount: sections.rules.length,
    noteCount: sections.notes.length,
    characterCount: body.length,
    lineCount: bodyLineCount,
  };

  const prompt: ParsedProgramPrompt = {
    rawHeading,
    body,
    startLine: promptHeadingIdx + 1,
    endLine: sprintEndLine,
    characterCount: body.length,
    lineCount: bodyLineCount,
    sections,
    stats,
  };

  return { prompt, warnings: collectedWarnings };
}

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

      const { prompt, warnings: promptWarnings } = extractPrompt(lines, s.startLine, s.endLine, s.startLine);
      for (const w of promptWarnings) warnings.push(w);

      sprints.push({
        number: s.number,
        title: s.title,
        rawHeading: s.rawHeading,
        startLine: s.startLine,
        endLine: s.endLine,
        epicNumber: s.epicNumber,
        ...(prompt ? { prompt } : {}),
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
