import test from "node:test";
import assert from "node:assert/strict";

import {
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CLAIM_SAFE_PHRASES,
  PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_PROHIBITED_OVERCLAIM_PHRASES,
  assertNoPMFreakAocEvidenceRequirementHandoffOverclaim,
  evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("catches every prohibited overclaim phrase at least once", () => {
  for (const phrase of PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_PROHIBITED_OVERCLAIM_PHRASES) {
    const result = evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety({ text: `This output claims ${phrase} in some sentence.` });
    assert.equal(result.safe, false, `expected "${phrase}" to be caught`);
    assert.ok(result.unsafePhrases.includes(phrase));
  }
});

test("never false-positives on any known-safe phrase", () => {
  for (const phrase of PMFREAK_AOC_EVIDENCE_REQUIREMENT_HANDOFF_CLAIM_SAFE_PHRASES) {
    const result = evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety({ text: phrase });
    assert.equal(result.safe, true, `expected "${phrase}" to be safe, but found: ${result.unsafePhrases.join(", ")}`);
  }
});

test("assertNoPMFreakAocEvidenceRequirementHandoffOverclaim throws on an unsafe value", () => {
  assert.throws(() => assertNoPMFreakAocEvidenceRequirementHandoffOverclaim({ text: "evidence approved" }), /prohibited overclaim/i);
});

test("assertNoPMFreakAocEvidenceRequirementHandoffOverclaim does not throw on a safe value", () => {
  assert.doesNotThrow(() => assertNoPMFreakAocEvidenceRequirementHandoffOverclaim({ text: "Evidence required" }));
});

test("evaluate is case-insensitive", () => {
  const result = evaluatePMFreakAocEvidenceRequirementHandoffClaimSafety({ text: "TASK CREATED" });
  assert.equal(result.safe, false);
});
