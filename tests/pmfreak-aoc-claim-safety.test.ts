import test from "node:test";
import assert from "node:assert/strict";

import {
  assertNoPMFreakAocGovernanceOverclaim,
  createPMFreakAocGovernanceRequestClientDescriptor,
  demoPMFreakAocBillingAllowedResponse,
  demoPMFreakAocBillingMissingEvidenceRequest,
  evaluatePMFreakAocGovernanceClaimSafety,
  PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES,
  PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor, request and response outputs pass the no-overclaim check", async () => {
  const response = await demoPMFreakAocBillingAllowedResponse();

  assert.doesNotThrow(() => assertNoPMFreakAocGovernanceOverclaim(createPMFreakAocGovernanceRequestClientDescriptor()));
  assert.doesNotThrow(() => assertNoPMFreakAocGovernanceOverclaim(demoPMFreakAocBillingMissingEvidenceRequest()));
  assert.doesNotThrow(() => assertNoPMFreakAocGovernanceOverclaim(response));
});

test("unsafe overclaim phrases are caught", () => {
  for (const phrase of PMFREAK_AOC_GOVERNANCE_PROHIBITED_OVERCLAIM_PHRASES) {
    const result = evaluatePMFreakAocGovernanceClaimSafety({ note: `This output claims: ${phrase}.` });
    assert.equal(result.safe, false);
    assert.ok(result.foundPhrases.includes(phrase));
    assert.throws(() => assertNoPMFreakAocGovernanceOverclaim({ note: phrase }));
  }
});

test("safe phrases never false-positive against the prohibited overclaim scan", () => {
  for (const phrase of PMFREAK_AOC_GOVERNANCE_CLAIM_SAFE_PHRASES) {
    const result = evaluatePMFreakAocGovernanceClaimSafety({ note: phrase });
    assert.equal(result.safe, true, `safe phrase "${phrase}" incorrectly flagged as overclaim`);
  }
});
