import test from "node:test";
import assert from "node:assert/strict";

import {
  assertNoPMFreakAocRemoteGovernanceTransportOverclaim,
  createPMFreakAocRemoteGovernanceTransportDescriptor,
  demoPMFreakAocRemoteTransportBillingAllowedEndpointBody,
  evaluatePMFreakAocRemoteGovernanceTransportClaimSafety,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CLAIM_SAFE_PHRASES,
  PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_PROHIBITED_OVERCLAIM_PHRASES,
} from "../src/features/pmfreak-integrations/aoc-governance-request-client";

test("descriptor and fixture outputs pass the no-overclaim check", () => {
  assert.doesNotThrow(() => assertNoPMFreakAocRemoteGovernanceTransportOverclaim(createPMFreakAocRemoteGovernanceTransportDescriptor()));
  assert.doesNotThrow(() =>
    assertNoPMFreakAocRemoteGovernanceTransportOverclaim(demoPMFreakAocRemoteTransportBillingAllowedEndpointBody()),
  );
});

test("unsafe overclaim phrases are caught", () => {
  for (const phrase of PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_PROHIBITED_OVERCLAIM_PHRASES) {
    const result = evaluatePMFreakAocRemoteGovernanceTransportClaimSafety({ note: `This output claims: ${phrase}.` });
    assert.equal(result.safe, false);
    assert.ok(result.unsafePhrases.includes(phrase));
    assert.throws(() => assertNoPMFreakAocRemoteGovernanceTransportOverclaim({ note: phrase }));
  }
});

test("safe phrases never false-positive against the prohibited overclaim scan", () => {
  for (const phrase of PMFREAK_AOC_REMOTE_GOVERNANCE_TRANSPORT_CLAIM_SAFE_PHRASES) {
    const result = evaluatePMFreakAocRemoteGovernanceTransportClaimSafety({ note: phrase });
    assert.equal(result.safe, true, `safe phrase "${phrase}" incorrectly flagged as overclaim`);
  }
});
