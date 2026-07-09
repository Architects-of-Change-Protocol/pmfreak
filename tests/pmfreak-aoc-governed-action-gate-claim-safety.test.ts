import test from "node:test";
import assert from "node:assert/strict";

import {
  assertNoPMFreakAocGovernedActionGateOverclaim,
  evaluatePMFreakAocGovernedActionGateClaimSafety,
  PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

const UNSAFE_PHRASES = [
  "production authorized",
  "legally approved",
  "compliance passed",
  "invoice validity certified",
  "customer acceptance certified",
  "execution approved",
  "action executed",
  "decision enforced",
  "automatically executed",
  "invoice approved",
  "customer accepted",
];

for (const phrase of UNSAFE_PHRASES) {
  test(`claim-safety catches "${phrase}"`, () => {
    const result = evaluatePMFreakAocGovernedActionGateClaimSafety({ text: `This gate result implies ${phrase}.` });
    assert.equal(result.safe, false);
    assert.ok(result.unsafePhrases.includes(phrase));
    assert.throws(() => assertNoPMFreakAocGovernedActionGateOverclaim({ text: phrase }));
  });
}

test("claim-safety does not false-positive on the module's own safe-phrase corpus", () => {
  for (const phrase of PMFREAK_AOC_GOVERNED_ACTION_GATE_CLAIM_SAFE_PHRASES) {
    const result = evaluatePMFreakAocGovernedActionGateClaimSafety({ text: phrase });
    assert.equal(result.safe, true, `expected safe phrase "${phrase}" not to trip the overclaim scan`);
  }
});

test("claim-safety allows the standard passed/blocked/needs-* vocabulary", () => {
  const phrases = ["Passed the governance gate", "Blocked by governance gate", "Needs evidence", "Needs approval", "Needs review"];
  for (const phrase of phrases) {
    assert.equal(evaluatePMFreakAocGovernedActionGateClaimSafety(phrase).safe, true);
  }
});
