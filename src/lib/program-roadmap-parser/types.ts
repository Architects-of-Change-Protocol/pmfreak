import type {
  ProgramRoadmapParseResultRow,
  ProgramRoadmapParseStatus,
} from "@/lib/db/database-contract";

export type { ProgramRoadmapParseResultRow, ProgramRoadmapParseStatus };

export type ProgramRoadmapParseWarningCode =
  | "EPIC_WITHOUT_SPRINTS"
  | "SPRINT_TITLE_MISSING"
  | "NON_SEQUENTIAL_EPIC_NUMBER"
  | "NON_SEQUENTIAL_SPRINT_NUMBER"
  | "TEXT_OUTSIDE_EPIC"
  | "UNRECOGNIZED_HEADING"
  | "EMPTY_SOURCE"
  | "SPRINT_WITHOUT_PROMPT"
  | "EMPTY_PROMPT"
  | "OBJECTIVE_MISSING"
  | "CAPABILITIES_MISSING"
  | "DELIVERABLES_MISSING"
  | "RULES_MISSING"
  | "PROMPT_TOO_LARGE"
  | "UNKNOWN_SECTION";

export type ProgramRoadmapParseErrorCode =
  | "SOURCE_NOT_FOUND"
  | "SOURCE_EMPTY"
  | "NO_EPICS_FOUND"
  | "SPRINT_WITHOUT_EPIC"
  | "DUPLICATE_EPIC_NUMBER"
  | "DUPLICATE_SPRINT_NUMBER";

export type ProgramRoadmapParseWarning = {
  code: ProgramRoadmapParseWarningCode;
  message: string;
  line?: number;
  context?: string;
};

export type ProgramRoadmapParseError = {
  code: ProgramRoadmapParseErrorCode;
  message: string;
  line?: number;
  context?: string;
};

export type PromptUnknownSection = {
  title: string;
  content: string;
};

export type PromptSections = {
  objective?: string;
  capabilities: string[];
  deliverables: string[];
  rules: string[];
  notes: string[];
  unknownSections: PromptUnknownSection[];
};

export type PromptStats = {
  sectionCount: number;
  capabilityCount: number;
  deliverableCount: number;
  ruleCount: number;
  noteCount: number;
  characterCount: number;
  lineCount: number;
};

export type ParsedProgramPrompt = {
  rawHeading: string;
  body: string;
  startLine: number;
  endLine: number;
  characterCount: number;
  lineCount: number;
  sections: PromptSections;
  stats: PromptStats;
};

export type ParsedProgramSprint = {
  number: number;
  title: string;
  rawHeading: string;
  startLine: number;
  endLine: number;
  epicNumber: number;
  prompt?: ParsedProgramPrompt;
};

export type ParsedProgramEpic = {
  number: number;
  title: string;
  rawHeading: string;
  startLine: number;
  endLine: number;
  sprints: ParsedProgramSprint[];
};

export type ProgramRoadmapParseStats = {
  totalLines: number;
  epicCount: number;
  sprintCount: number;
  emptyLineCount: number;
  unassignedSprintCount: number;
  duplicateEpicNumberCount: number;
  duplicateSprintNumberCount: number;
};

export type ProgramRoadmapParseResult = {
  programId: string;
  sourceId: string;
  parsedAt: Date;
  status: ProgramRoadmapParseStatus;
  epics: ParsedProgramEpic[];
  warnings: ProgramRoadmapParseWarning[];
  errors: ProgramRoadmapParseError[];
  stats: ProgramRoadmapParseStats;
};

export type ProgramRoadmapParserResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failureClass: string };

export type ProgramRoadmapParseResultEventType =
  | "PROGRAM_ROADMAP_PARSED"
  | "PROGRAM_ROADMAP_PARSE_FAILED"
  | "PROGRAM_ROADMAP_PARSE_RESULT_ARCHIVED";
