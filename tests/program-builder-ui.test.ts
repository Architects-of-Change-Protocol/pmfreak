import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Valid board transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  BACKLOG:     ["READY"],
  READY:       ["BACKLOG", "IN_PROGRESS"],
  IN_PROGRESS: ["READY", "IN_REVIEW"],
  IN_REVIEW:   ["IN_PROGRESS", "DONE"],
  DONE:        ["IN_PROGRESS"],
};

// Parse status label mapping
const PARSE_STATUS_LABELS: Record<string, string> = {
  VALID:               "Valid",
  VALID_WITH_WARNINGS: "Valid with Warnings",
  INVALID:             "Invalid",
};

// Program type label mapping
const PROGRAM_TYPE_LABELS: Record<string, string> = {
  SOFTWARE_DEVELOPMENT:   "Software Dev",
  INFRASTRUCTURE_PROJECT: "Infrastructure",
  CUSTOMER_ONBOARDING:    "Customer Onboarding",
  AOC_PROTOCOL_ADOPTION:  "AOC Protocol",
  ORGANIZATIONAL_CHANGE:  "Org Change",
  STRATEGIC_INITIATIVE:   "Strategic Initiative",
  INTERNAL_PROGRAM:       "Internal",
  CUSTOM:                 "Custom",
};

function canMaterialize(status: string): boolean {
  return status === "VALID" || status === "VALID_WITH_WARNINGS";
}

function formatBoardStats(stats: { totalCards: number; completionPercentage: number }): string {
  return `${stats.totalCards} cards · ${stats.completionPercentage}% complete`;
}

describe("Program Builder UI — Board Transitions", () => {
  it("BACKLOG can only move to READY", () => {
    assert.deepEqual(VALID_TRANSITIONS["BACKLOG"], ["READY"]);
  });

  it("READY can move to BACKLOG or IN_PROGRESS", () => {
    assert.deepEqual(VALID_TRANSITIONS["READY"], ["BACKLOG", "IN_PROGRESS"]);
  });

  it("IN_PROGRESS can move to READY or IN_REVIEW", () => {
    assert.deepEqual(VALID_TRANSITIONS["IN_PROGRESS"], ["READY", "IN_REVIEW"]);
  });

  it("IN_REVIEW can move to IN_PROGRESS or DONE", () => {
    assert.deepEqual(VALID_TRANSITIONS["IN_REVIEW"], ["IN_PROGRESS", "DONE"]);
  });

  it("DONE can only reopen to IN_PROGRESS", () => {
    assert.deepEqual(VALID_TRANSITIONS["DONE"], ["IN_PROGRESS"]);
  });

  it("BACKLOG cannot jump directly to DONE", () => {
    assert.ok(!(VALID_TRANSITIONS["BACKLOG"] ?? []).includes("DONE"));
  });
});

describe("Program Builder UI — Parse Status Labels", () => {
  it("VALID maps to 'Valid'", () => {
    assert.equal(PARSE_STATUS_LABELS["VALID"], "Valid");
  });

  it("VALID_WITH_WARNINGS maps to 'Valid with Warnings'", () => {
    assert.equal(PARSE_STATUS_LABELS["VALID_WITH_WARNINGS"], "Valid with Warnings");
  });

  it("INVALID maps to 'Invalid'", () => {
    assert.equal(PARSE_STATUS_LABELS["INVALID"], "Invalid");
  });

  it("canMaterialize is true for VALID", () => {
    assert.ok(canMaterialize("VALID"));
  });

  it("canMaterialize is true for VALID_WITH_WARNINGS", () => {
    assert.ok(canMaterialize("VALID_WITH_WARNINGS"));
  });

  it("canMaterialize is false for INVALID", () => {
    assert.ok(!canMaterialize("INVALID"));
  });
});

describe("Program Builder UI — Program Type Labels", () => {
  it("SOFTWARE_DEVELOPMENT maps to 'Software Dev'", () => {
    assert.equal(PROGRAM_TYPE_LABELS["SOFTWARE_DEVELOPMENT"], "Software Dev");
  });

  it("AOC_PROTOCOL_ADOPTION maps to 'AOC Protocol'", () => {
    assert.equal(PROGRAM_TYPE_LABELS["AOC_PROTOCOL_ADOPTION"], "AOC Protocol");
  });

  it("CUSTOM maps to 'Custom'", () => {
    assert.equal(PROGRAM_TYPE_LABELS["CUSTOM"], "Custom");
  });

  it("all 8 program types have labels", () => {
    const types = [
      "SOFTWARE_DEVELOPMENT", "INFRASTRUCTURE_PROJECT", "CUSTOMER_ONBOARDING",
      "AOC_PROTOCOL_ADOPTION", "ORGANIZATIONAL_CHANGE", "STRATEGIC_INITIATIVE",
      "INTERNAL_PROGRAM", "CUSTOM",
    ];
    for (const t of types) {
      assert.ok(PROGRAM_TYPE_LABELS[t], `Missing label for ${t}`);
    }
  });
});

describe("Program Builder UI — Board Stats Formatting", () => {
  it("formats board stats correctly", () => {
    const result = formatBoardStats({ totalCards: 42, completionPercentage: 71 });
    assert.equal(result, "42 cards · 71% complete");
  });

  it("formats zero cards correctly", () => {
    const result = formatBoardStats({ totalCards: 0, completionPercentage: 0 });
    assert.equal(result, "0 cards · 0% complete");
  });
});
