import test from "node:test";
import assert from "node:assert/strict";

import {
  assertNoPMFreakAocDecisionInboxOverclaim,
  evaluatePMFreakAocDecisionInboxClaimSafety,
  PMFREAK_AOC_DECISION_INBOX_CLAIM_SAFE_PHRASES,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("claim-safety catches unsafe phrases", () => {
  for (const phrase of ["production authorized", "execution approved", "action executed", "decision enforced", "compliance passed"]) {
    const result = evaluatePMFreakAocDecisionInboxClaimSafety({ note: `This is ${phrase}.` });
    assert.equal(result.safe, false, `expected "${phrase}" to be flagged`);
    assert.ok(result.unsafePhrases.includes(phrase));
  }
});

test("claim-safety does not false-positive on safe phrases", () => {
  const result = evaluatePMFreakAocDecisionInboxClaimSafety({ labels: [...PMFREAK_AOC_DECISION_INBOX_CLAIM_SAFE_PHRASES] });
  assert.equal(result.safe, true);
  assert.deepEqual(result.unsafePhrases, []);
});

test("assertNoPMFreakAocDecisionInboxOverclaim throws for unsafe content", () => {
  assert.throws(() => assertNoPMFreakAocDecisionInboxOverclaim({ note: "customer acceptance certified" }));
});

test("assertNoPMFreakAocDecisionInboxOverclaim does not throw for safe content", () => {
  assert.doesNotThrow(() => assertNoPMFreakAocDecisionInboxOverclaim({ note: "Display only. Evidence required." }));
});

test("claim-safety result includes the checked text", () => {
  const result = evaluatePMFreakAocDecisionInboxClaimSafety({ note: "Display only" });
  assert.ok(result.checkedText.includes("display only"));
});
