import test from "node:test";
import assert from "node:assert/strict";

import { createJurisdictionPack, demoJurisdictionPackCR, validateJurisdictionPack } from "../src/features/domain-policy-pack-runtime/jurisdiction";

// Test 2: validates safe pack
test("validateJurisdictionPack accepts a valid demo jurisdiction pack fixture", () => {
  const result = validateJurisdictionPack(demoJurisdictionPackCR());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

// Test 3: rejects pack claiming legal advice
test("validateJurisdictionPack rejects a pack whose scope claims legalAdvice = true", () => {
  const pack = demoJurisdictionPackCR();
  const tampered = { ...pack, scope: { ...pack.scope, legalAdvice: true as unknown as false } };

  const result = validateJurisdictionPack(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /legal advice/i.test(error)));
});

// Test 4: rejects pack claiming compliance certification
test("validateJurisdictionPack rejects a pack whose scope claims complianceCertification = true", () => {
  const pack = demoJurisdictionPackCR();
  const tampered = { ...pack, scope: { ...pack.scope, complianceCertification: true as unknown as false } };

  const result = validateJurisdictionPack(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /compliance certification/i.test(error)));
});

// Test 5: rejects jurisdictional compliance claim
test("validateJurisdictionPack rejects a pack whose metadata claims jurisdictionalComplianceClaimed = true", () => {
  const pack = demoJurisdictionPackCR();
  const tampered = {
    ...pack,
    metadata: { ...pack.metadata, jurisdictionalComplianceClaimed: true as unknown as false },
  };

  const result = validateJurisdictionPack(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /jurisdictional compliance/i.test(error)));
});

// Test 6: rejects completeness claim
test("validateJurisdictionPack rejects a pack whose scope claims completenessClaimed = true", () => {
  const pack = demoJurisdictionPackCR();
  const tampered = { ...pack, scope: { ...pack.scope, completenessClaimed: true as unknown as false } };

  const result = validateJurisdictionPack(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /completeness/i.test(error)));
});

test("validateJurisdictionPack rejects a pack whose metadata claims policyModelStatus is not partial (completeness overclaim)", () => {
  const pack = demoJurisdictionPackCR();
  const tampered = {
    ...pack,
    metadata: { ...pack.metadata, policyModelStatus: "complete_policy_model" as unknown as "partial_policy_model" },
  };

  const result = validateJurisdictionPack(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /completeness/i.test(error)));
});

test("validateJurisdictionPack flags active status combined with expired/superseded validationStatus", () => {
  const pack = createJurisdictionPack({
    id: "fixture.jurisdiction.bad-active-expired.v1",
    name: "Active but expired validation",
    version: "1.0.0",
    status: "active",
    validationStatus: "expired",
    jurisdiction: { known: true, countryCode: "CR" },
  });

  const result = validateJurisdictionPack(pack);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /active/i.test(error) && /expired|superseded/i.test(error)));
});

test("validateJurisdictionPack rejects prohibited overclaim language embedded in pack labels", () => {
  const pack = demoJurisdictionPackCR();
  const tampered = { ...pack, name: "Certified compliant jurisdiction pack" };

  const result = validateJurisdictionPack(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /prohibited overclaim/i.test(error)));
});
