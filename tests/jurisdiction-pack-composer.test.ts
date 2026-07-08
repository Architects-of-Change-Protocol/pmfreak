import test from "node:test";
import assert from "node:assert/strict";

import { composeJurisdictionWithBaseline, createJurisdictionPack } from "../src/features/domain-policy-pack-runtime/jurisdiction";

const BASELINE_ID = "aoc.global_legal_baseline.v1";

// Test 19: composition requires global baseline dependency
test("composeJurisdictionWithBaseline reports composed=false when the baseline dependency is not declared", () => {
  const pack = createJurisdictionPack({
    id: "fixture.jurisdiction.no-baseline.v1",
    name: "Pack without baseline dependency",
    version: "1.0.0",
    validationStatus: "demo_baseline",
    jurisdiction: { known: true, countryCode: "CR" },
  });

  const composition = composeJurisdictionWithBaseline(pack, BASELINE_ID);

  assert.equal(composition.composed, false);
  assert.ok(composition.missingPackIds.includes(BASELINE_ID));
  assert.equal(composition.metadata.requiredDisclaimer, "not_legal_advice");
  assert.equal(composition.metadata.complianceClaimed, false);
});

// Test 20: valid composition with global baseline
test("composeJurisdictionWithBaseline reports composed=true when the baseline dependency is declared", () => {
  const pack = createJurisdictionPack({
    id: "fixture.jurisdiction.with-baseline.v1",
    name: "Pack with baseline dependency",
    version: "1.0.0",
    validationStatus: "demo_baseline",
    jurisdiction: { known: true, countryCode: "CR" },
    requiredBaselinePackIds: [BASELINE_ID],
    extendsPackIds: [BASELINE_ID],
  });

  const composition = composeJurisdictionWithBaseline(pack, BASELINE_ID);

  assert.equal(composition.composed, true);
  assert.deepEqual(composition.missingPackIds, []);
  assert.ok(composition.includedPackIds.includes(BASELINE_ID));
  assert.ok(composition.includedPackIds.includes(pack.id));
  assert.equal(composition.metadata.policyModelStatus, "partial_policy_model");
  assert.equal(composition.metadata.jurisdictionalComplianceClaimed, false);
});
