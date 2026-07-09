import test from "node:test";
import assert from "node:assert/strict";

import { mapPMFreakAocGateVerdictToUILabel, mapPMFreakAocGateVerdictToUITone } from "../src/features/pmfreak-integrations/aoc-governance-request-client";
import type { PMFreakAocGovernedActionGateVerdict } from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const LABELS: Array<[PMFreakAocGovernedActionGateVerdict, string]> = [
  ["passed", "Passed"],
  ["blocked", "Blocked"],
  ["held", "Held"],
  ["needs_evidence", "Needs Evidence"],
  ["needs_approval", "Needs Approval"],
  ["needs_review", "Needs Review"],
  ["error", "Error"],
];

for (const [verdict, label] of LABELS) {
  test(`${verdict} maps to label ${label}`, () => {
    assert.equal(mapPMFreakAocGateVerdictToUILabel(verdict), label);
  });
}

const TONES: Array<[PMFreakAocGovernedActionGateVerdict, string]> = [
  ["passed", "success"],
  ["blocked", "danger"],
  ["held", "warning"],
  ["needs_evidence", "warning"],
  ["needs_approval", "warning"],
  ["needs_review", "warning"],
  ["error", "danger"],
];

for (const [verdict, tone] of TONES) {
  test(`${verdict} maps to ${tone} tone`, () => {
    assert.equal(mapPMFreakAocGateVerdictToUITone(verdict), tone);
  });
}
