import test from "node:test";
import assert from "node:assert/strict";

import {
  assertNoPMFreakAocGateResultUIOverclaim,
  evaluatePMFreakAocGateResultUIClaimSafety,
  PMFREAK_AOC_GATE_RESULT_UI_CLAIM_SAFE_PHRASES,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const UNSAFE_PHRASES = ["action executed", "decision enforced", "invoice approved", "click to execute", "execute now", "approve invoice", "send to customer"];

for (const phrase of UNSAFE_PHRASES) {
  test(`claim-safety catches "${phrase}"`, () => {
    const result = evaluatePMFreakAocGateResultUIClaimSafety({ text: `this action was subject to ${phrase}` });
    assert.equal(result.safe, false);
    assert.ok(result.unsafePhrases.includes(phrase));
    assert.throws(() => assertNoPMFreakAocGateResultUIOverclaim({ text: phrase }));
  });
}

test("claim-safety does not false-positive on safe phrases", () => {
  const result = evaluatePMFreakAocGateResultUIClaimSafety({ text: PMFREAK_AOC_GATE_RESULT_UI_CLAIM_SAFE_PHRASES.join(". ") });
  assert.equal(result.safe, true);
  assert.deepEqual(result.unsafePhrases, []);
});
