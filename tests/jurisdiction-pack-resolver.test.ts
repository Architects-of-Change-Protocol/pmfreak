import test from "node:test";
import assert from "node:assert/strict";

import {
  counselAttestedJurisdictionPack,
  counselReviewedJurisdictionPack,
  createJurisdictionPackRegistry,
  customerProvidedJurisdictionPack,
  customerValidatedJurisdictionPack,
  demoJurisdictionPackCR,
  expiredJurisdictionPack,
  resolveJurisdictionPacks,
  supersededJurisdictionPack,
} from "../src/features/domain-policy-pack-runtime/jurisdiction";
import { buildResolutionInput } from "./jurisdiction-pack-test-helpers";

const HOLD_OR_LEGAL_REVIEW = ["hold", "require_legal_review"];

// Test 7: resolves unknown jurisdiction safely
test("unknown jurisdiction + legally sensitive resolves to hold or require_legal_review", () => {
  const registry = createJurisdictionPackRegistry();
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: false },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
    }),
    registry
  );

  assert.ok(HOLD_OR_LEGAL_REVIEW.includes(resolution.decision));
  assert.equal(resolution.jurisdictionKnown, false);
  assert.equal(resolution.metadata.requiredDisclaimer, "not_legal_advice");
  assert.equal(resolution.metadata.complianceClaimed, false);
});

// Test 8: resolves ambiguous jurisdiction safely
test("ambiguous jurisdiction + legally sensitive resolves to require_legal_review", () => {
  const registry = createJurisdictionPackRegistry();
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR", ambiguous: true },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
    }),
    registry
  );

  assert.equal(resolution.decision, "require_legal_review");
  assert.equal(resolution.jurisdictionAmbiguous, true);
});

// Test 9: resolves jurisdiction conflict safely
test("conflicting jurisdiction + legally sensitive resolves to require_legal_review", () => {
  const registry = createJurisdictionPackRegistry();
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR", conflictDetected: true },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
    }),
    registry
  );

  assert.equal(resolution.decision, "require_legal_review");
  assert.equal(resolution.jurisdictionConflictDetected, true);
});

// Test 10: missing jurisdiction pack triggers review
test("known jurisdiction with no matching pack and legally sensitive action requires legal review", () => {
  const registry = createJurisdictionPackRegistry();
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
    }),
    registry
  );

  assert.ok(["require_legal_review", "require_counsel_review"].includes(resolution.decision));
  assert.ok(resolution.missingPackIds.length > 0);
});

// Test 11: non-sensitive action does not require jurisdiction pack
test("non-sensitive action with no matching pack allows with safe metadata", () => {
  const registry = createJurisdictionPackRegistry();

  for (const jurisdiction of [{ known: true, countryCode: "CR" }, { known: false }]) {
    const resolution = resolveJurisdictionPacks(
      buildResolutionInput({
        jurisdiction,
        legalSensitivity: { legallySensitive: false, categories: [] },
      }),
      registry
    );

    assert.equal(resolution.decision, "allow");
    assert.equal(resolution.metadata.requiredDisclaimer, "not_legal_advice");
    assert.equal(resolution.metadata.complianceClaimed, false);
  }
});

function registryWithSinglePack(pack: ReturnType<typeof demoJurisdictionPackCR>) {
  const registry = createJurisdictionPackRegistry();
  registry.register(pack);
  return registry;
}

// Test 12: demo_baseline cannot satisfy counsel_reviewed
test("demo_baseline pack cannot satisfy a counsel_reviewed requirement", () => {
  const registry = registryWithSinglePack(demoJurisdictionPackCR());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
      requiredValidationStatus: ["counsel_reviewed"],
    }),
    registry
  );

  assert.equal(resolution.decision, "require_counsel_review");
  assert.equal(resolution.validationStatusSatisfied, false);
});

// Test 13: customer_provided cannot satisfy counsel_reviewed
test("customer_provided pack cannot satisfy a counsel_reviewed requirement", () => {
  const registry = registryWithSinglePack(customerProvidedJurisdictionPack());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
      requiredValidationStatus: ["counsel_reviewed"],
    }),
    registry
  );

  assert.equal(resolution.decision, "require_counsel_review");
  assert.equal(resolution.validationStatusSatisfied, false);
});

// Test 14: customer_validated cannot satisfy counsel_reviewed
test("customer_validated pack cannot satisfy a counsel_reviewed requirement", () => {
  const registry = registryWithSinglePack(customerValidatedJurisdictionPack());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
      requiredValidationStatus: ["counsel_reviewed"],
    }),
    registry
  );

  assert.equal(resolution.decision, "require_counsel_review");
  assert.equal(resolution.validationStatusSatisfied, false);
});

// Test 15: counsel_reviewed satisfies counsel_reviewed
test("counsel_reviewed pack satisfies a counsel_reviewed requirement", () => {
  const registry = registryWithSinglePack(counselReviewedJurisdictionPack());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
      requiredValidationStatus: ["counsel_reviewed"],
    }),
    registry
  );

  assert.equal(resolution.decision, "allow");
  assert.equal(resolution.validationStatusSatisfied, true);
});

// Test 16: counsel_attested satisfies counsel_reviewed
test("counsel_attested pack satisfies a counsel_reviewed requirement", () => {
  const registry = registryWithSinglePack(counselAttestedJurisdictionPack());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
      requiredValidationStatus: ["counsel_reviewed"],
    }),
    registry
  );

  assert.equal(resolution.decision, "allow");
  assert.equal(resolution.validationStatusSatisfied, true);
});

// Test 17: expired pack cannot be used
test("expired pack cannot be used as a valid active pack", () => {
  const registry = registryWithSinglePack(expiredJurisdictionPack());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
    }),
    registry
  );

  assert.ok(HOLD_OR_LEGAL_REVIEW.includes(resolution.decision));
  assert.equal(resolution.validationStatusSatisfied, false);
});

// Test 18: superseded pack cannot be used
test("superseded pack cannot be used as a valid active pack", () => {
  const registry = registryWithSinglePack(supersededJurisdictionPack());
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
    }),
    registry
  );

  assert.ok(HOLD_OR_LEGAL_REVIEW.includes(resolution.decision));
  assert.equal(resolution.validationStatusSatisfied, false);
});

test("required baseline pack missing from registry resolves to hold", () => {
  const registry = createJurisdictionPackRegistry();
  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: false, categories: [] },
      requiredBaselinePackIds: ["aoc.global_legal_baseline.v1"],
    }),
    registry
  );

  assert.equal(resolution.decision, "hold");
  assert.ok(resolution.missingPackIds.includes("aoc.global_legal_baseline.v1"));
});
