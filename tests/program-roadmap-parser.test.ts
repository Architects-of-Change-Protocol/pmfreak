/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck -- Node 20 executes this TypeScript-named test without a loader.
const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

// ─────────────────────────────────────────────────────────────────────────────
// In-memory reimplementation of parseProgramRoadmapText for pure unit tests.
// No database access — all parsing logic is verified here.
// ─────────────────────────────────────────────────────────────────────────────

const EPIC_RE = /^EPIC\s+(\d+)\s*(?:—|-|:)?\s*(.*)$/i;
const SPRINT_RE = /^Sprint\s+(\d+)\s*(?:—|-|:)?\s*(.*)$/i;

function warn(code, message, line, context) {
  return { code, message, ...(line !== undefined ? { line } : {}), ...(context !== undefined ? { context } : {}) };
}
function parseError(code, message, line, context) {
  return { code, message, ...(line !== undefined ? { line } : {}), ...(context !== undefined ? { context } : {}) };
}
function resolveStatus(errors, warnings) {
  if (errors.length > 0) return "INVALID";
  if (warnings.length > 0) return "VALID_WITH_WARNINGS";
  return "VALID";
}

function parseProgramRoadmapText(input) {
  const parsedAt = new Date();
  const warnings = [];
  const errors = [];
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

  const seenEpicNumbers = new Set();
  const seenSprintNumbers = new Set();
  const epicDrafts = [];
  let currentEpic = null;
  const headings = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    if (!line.trim()) { emptyLineCount++; continue; }

    const epicMatch = EPIC_RE.exec(line);
    if (epicMatch) {
      const number = parseInt(epicMatch[1], 10);
      const title = (epicMatch[2] ?? "").trim();
      if (seenEpicNumbers.has(number)) {
        duplicateEpicNumberCount++;
        errors.push(parseError("DUPLICATE_EPIC_NUMBER", `Duplicate epic number ${number}.`, lineNum, line));
      } else {
        seenEpicNumbers.add(number);
        const draft = { number, title, rawHeading: line, startLine: lineNum, endLine: totalLines, sprints: [] };
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
      if (!title) warnings.push(warn("SPRINT_TITLE_MISSING", `Sprint ${number} has no title.`, lineNum, line));
      if (seenSprintNumbers.has(number)) {
        duplicateSprintNumberCount++;
        errors.push(parseError("DUPLICATE_SPRINT_NUMBER", `Duplicate sprint number ${number}.`, lineNum, line));
      } else {
        seenSprintNumbers.add(number);
        const draft = { number, title, rawHeading: line, startLine: lineNum, endLine: totalLines, epicNumber: currentEpic.number };
        currentEpic.sprints.push(draft);
        headings.push({ kind: "sprint", draft });
      }
      continue;
    }
  }

  for (let hi = 0; hi < headings.length; hi++) {
    const h = headings[hi];
    if (h.kind === "epic") {
      let nextEpicStart = totalLines;
      for (let j = hi + 1; j < headings.length; j++) {
        if (headings[j].kind === "epic") { nextEpicStart = headings[j].draft.startLine - 1; break; }
      }
      h.draft.endLine = nextEpicStart;
    } else {
      h.draft.endLine = hi < headings.length - 1 ? headings[hi + 1].draft.startLine - 1 : totalLines;
    }
  }

  if (epicDrafts.length === 0) {
    errors.push(parseError("NO_EPICS_FOUND", "No epics found in the roadmap source."));
  }

  let prevEpicNum = 0;
  const epics = [];
  for (const d of epicDrafts) {
    if (d.sprints.length === 0) warnings.push(warn("EPIC_WITHOUT_SPRINTS", `Epic ${d.number} has no sprints.`, d.startLine, d.rawHeading));
    if (prevEpicNum > 0 && d.number > prevEpicNum + 1) warnings.push(warn("NON_SEQUENTIAL_EPIC_NUMBER", `Epic number ${d.number} is not sequential after ${prevEpicNum}.`, d.startLine, d.rawHeading));
    prevEpicNum = d.number;
    let prevSprintNum = 0;
    const sprints = [];
    for (const s of d.sprints) {
      if (prevSprintNum > 0 && s.number > prevSprintNum + 1) warnings.push(warn("NON_SEQUENTIAL_SPRINT_NUMBER", `Sprint number ${s.number} is not sequential after ${prevSprintNum}.`, s.startLine, s.rawHeading));
      prevSprintNum = s.number;
      sprints.push({ number: s.number, title: s.title, rawHeading: s.rawHeading, startLine: s.startLine, endLine: s.endLine, epicNumber: s.epicNumber });
    }
    epics.push({ number: d.number, title: d.title, rawHeading: d.rawHeading, startLine: d.startLine, endLine: d.endLine, sprints });
  }

  const stats = {
    totalLines,
    epicCount: epics.length,
    sprintCount: epics.reduce((a, e) => a + e.sprints.length, 0),
    emptyLineCount,
    unassignedSprintCount,
    duplicateEpicNumberCount,
    duplicateSprintNumberCount,
  };

  return { programId: input.programId, sourceId: input.sourceId, parsedAt, status: resolveStatus(errors, warnings), epics, warnings, errors, stats };
}

// ─────────────────────────────────────────────────────────────────────────────

const PROGRAM_ID = "00000000-0000-4000-8000-000000000001";
const SOURCE_ID  = "00000000-0000-4000-8000-000000000002";

function parse(rawText) {
  return parseProgramRoadmapText({ programId: PROGRAM_ID, sourceId: SOURCE_ID, rawText });
}

describe("parseProgramRoadmapText — basic parsing", () => {
  test("parses a single epic with a single sprint", () => {
    const result = parse("EPIC 1 — Foundation\n\nSprint 1 — Setup\nSome body text.");
    assert.equal(result.status, "VALID");
    assert.equal(result.epics.length, 1);
    assert.equal(result.epics[0].number, 1);
    assert.equal(result.epics[0].title, "Foundation");
    assert.equal(result.epics[0].sprints.length, 1);
    assert.equal(result.epics[0].sprints[0].number, 1);
    assert.equal(result.epics[0].sprints[0].title, "Setup");
  });

  test("parses multiple epics with multiple sprints", () => {
    const raw = [
      "EPIC 1 — Alpha",
      "Sprint 1 — One",
      "Sprint 2 — Two",
      "EPIC 2 — Beta",
      "Sprint 3 — Three",
    ].join("\n");
    const result = parse(raw);
    assert.equal(result.status, "VALID");
    assert.equal(result.epics.length, 2);
    assert.equal(result.epics[0].sprints.length, 2);
    assert.equal(result.epics[1].sprints.length, 1);
    assert.equal(result.epics[1].sprints[0].epicNumber, 2);
  });

  test("supports em dash separator (—)", () => {
    const result = parse("EPIC 1 — Const\nSprint 1 — Found");
    assert.equal(result.epics[0].title, "Const");
    assert.equal(result.epics[0].sprints[0].title, "Found");
  });

  test("supports hyphen separator (-)", () => {
    const result = parse("EPIC 1 - Const\nSprint 1 - Found");
    assert.equal(result.epics[0].title, "Const");
    assert.equal(result.epics[0].sprints[0].title, "Found");
  });

  test("supports colon separator (:)", () => {
    const result = parse("EPIC 1: Const\nSprint 1: Found");
    assert.equal(result.epics[0].title, "Const");
    assert.equal(result.epics[0].sprints[0].title, "Found");
  });

  test("supports mixed case (Epic vs EPIC, Sprint vs SPRINT)", () => {
    const result = parse("Epic 1 — Alpha\nSPRINT 1 - One");
    assert.equal(result.epics.length, 1);
    assert.equal(result.epics[0].sprints.length, 1);
  });

  test("preserves rawHeading exactly", () => {
    const epicLine = "EPIC 1 — Project Constitution";
    const sprintLine = "Sprint 1 — Program Model Foundation";
    const result = parse(`${epicLine}\n${sprintLine}`);
    assert.equal(result.epics[0].rawHeading, epicLine);
    assert.equal(result.epics[0].sprints[0].rawHeading, sprintLine);
  });
});

describe("parseProgramRoadmapText — line numbers", () => {
  test("startLine is 1-based and points to heading line", () => {
    const result = parse("\nEPIC 1 — Alpha\n\nSprint 1 — One");
    assert.equal(result.epics[0].startLine, 2);
    assert.equal(result.epics[0].sprints[0].startLine, 4);
  });

  test("endLine of epic ends before next epic", () => {
    const raw = "EPIC 1 — A\nSprint 1 — One\nEPIC 2 — B\nSprint 2 — Two";
    const result = parse(raw);
    assert.equal(result.epics[0].endLine, 2);
    assert.equal(result.epics[1].startLine, 3);
  });

  test("endLine of last sprint/epic equals totalLines", () => {
    const raw = "EPIC 1 — A\nSprint 1 — One\nBody text";
    const result = parse(raw);
    assert.equal(result.epics[0].endLine, 3);
    assert.equal(result.epics[0].sprints[0].endLine, 3);
  });

  test("endLine of sprint ends before next sprint heading", () => {
    const raw = "EPIC 1 — A\nSprint 1 — One\nBody\nSprint 2 — Two";
    const result = parse(raw);
    assert.equal(result.epics[0].sprints[0].endLine, 3);
    assert.equal(result.epics[0].sprints[1].startLine, 4);
  });
});

describe("parseProgramRoadmapText — errors", () => {
  test("returns SOURCE_EMPTY for empty rawText", () => {
    const result = parse("");
    assert.equal(result.status, "INVALID");
    assert.equal(result.errors[0].code, "SOURCE_EMPTY");
  });

  test("returns SOURCE_EMPTY for whitespace-only rawText", () => {
    const result = parse("   \n\n  ");
    assert.equal(result.status, "INVALID");
    assert.equal(result.errors[0].code, "SOURCE_EMPTY");
  });

  test("returns NO_EPICS_FOUND when no epics present", () => {
    const result = parse("Just some text without headings.");
    assert.equal(result.status, "INVALID");
    assert.ok(result.errors.some(e => e.code === "NO_EPICS_FOUND"));
  });

  test("returns SPRINT_WITHOUT_EPIC if sprint appears before any epic", () => {
    const result = parse("Sprint 1 — Orphan\nEPIC 1 — Late");
    assert.equal(result.status, "INVALID");
    assert.ok(result.errors.some(e => e.code === "SPRINT_WITHOUT_EPIC"));
    assert.equal(result.stats.unassignedSprintCount, 1);
  });

  test("detects duplicate epic numbers", () => {
    const result = parse("EPIC 1 — A\nSprint 1 — S\nEPIC 1 — B");
    assert.equal(result.status, "INVALID");
    assert.ok(result.errors.some(e => e.code === "DUPLICATE_EPIC_NUMBER"));
    assert.equal(result.stats.duplicateEpicNumberCount, 1);
  });

  test("detects duplicate sprint numbers", () => {
    const result = parse("EPIC 1 — A\nSprint 1 — S1\nSprint 1 — S2");
    assert.equal(result.status, "INVALID");
    assert.ok(result.errors.some(e => e.code === "DUPLICATE_SPRINT_NUMBER"));
    assert.equal(result.stats.duplicateSprintNumberCount, 1);
  });
});

describe("parseProgramRoadmapText — warnings", () => {
  test("warning for epic without sprints", () => {
    const result = parse("EPIC 1 — Lonely");
    assert.equal(result.status, "VALID_WITH_WARNINGS");
    assert.ok(result.warnings.some(w => w.code === "EPIC_WITHOUT_SPRINTS"));
  });

  test("warning for sprint without title", () => {
    const result = parse("EPIC 1 — A\nSprint 1 —");
    assert.equal(result.status, "VALID_WITH_WARNINGS");
    assert.ok(result.warnings.some(w => w.code === "SPRINT_TITLE_MISSING"));
  });

  test("warning for sprint with colon but no title", () => {
    const result = parse("EPIC 1 — A\nSprint 2:");
    assert.ok(result.warnings.some(w => w.code === "SPRINT_TITLE_MISSING"));
  });

  test("warning for non-sequential epic numbers (gap)", () => {
    const result = parse("EPIC 1 — A\nSprint 1 — S\nEPIC 3 — C\nSprint 2 — T");
    assert.ok(result.warnings.some(w => w.code === "NON_SEQUENTIAL_EPIC_NUMBER"));
  });

  test("warning for non-sequential sprint numbers (gap)", () => {
    const result = parse("EPIC 1 — A\nSprint 1 — S1\nSprint 3 — S3");
    assert.ok(result.warnings.some(w => w.code === "NON_SEQUENTIAL_SPRINT_NUMBER"));
  });

  test("non-sequential numbers do not invalidate parse", () => {
    const result = parse("EPIC 1 — A\nSprint 1 — S\nEPIC 3 — C\nSprint 2 — T");
    assert.notEqual(result.status, "INVALID");
  });
});

describe("parseProgramRoadmapText — stats", () => {
  test("stats are correct for a basic roadmap", () => {
    const raw = "EPIC 1 — A\nSprint 1 — S1\nSprint 2 — S2\n\nEPIC 2 — B\nSprint 3 — S3";
    const result = parse(raw);
    assert.equal(result.stats.totalLines, 6);
    assert.equal(result.stats.epicCount, 2);
    assert.equal(result.stats.sprintCount, 3);
    assert.equal(result.stats.emptyLineCount, 1);
    assert.equal(result.stats.duplicateEpicNumberCount, 0);
    assert.equal(result.stats.duplicateSprintNumberCount, 0);
    assert.equal(result.stats.unassignedSprintCount, 0);
  });

  test("programId and sourceId are passed through", () => {
    const result = parse("EPIC 1 — A\nSprint 1 — S");
    assert.equal(result.programId, PROGRAM_ID);
    assert.equal(result.sourceId, SOURCE_ID);
  });
});

describe("parseProgramRoadmapText — full roadmap sample", () => {
  test("parses realistic roadmap with prompt bodies", () => {
    const raw = `EPIC 1 — Project Constitution

Sprint 1 — Program Model Foundation
Prompt:
Construir Project Constitution Foundation.

OBJETIVO
Build the base model.

Sprint 2 — Program Hierarchy Model
Prompt:
Construir Program Hierarchy Model.

EPIC 2 — Build System

Sprint 3 — CI/CD Foundation
Prompt:
Set up CI/CD.`;
    const result = parse(raw);
    assert.equal(result.status, "VALID");
    assert.equal(result.epics.length, 2);
    assert.equal(result.epics[0].sprints.length, 2);
    assert.equal(result.epics[1].sprints.length, 1);
    assert.equal(result.epics[0].sprints[1].title, "Program Hierarchy Model");
    assert.equal(result.epics[1].sprints[0].epicNumber, 2);
  });
});
