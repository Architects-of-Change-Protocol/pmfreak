import test from "node:test";
import assert from "node:assert/strict";

import {
  JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES,
  JURISDICTION_SAFE_LABELS,
  JurisdictionOverclaimError,
  assertNoJurisdictionOverclaim,
  composeJurisdictionWithBaseline,
  counselReviewedJurisdictionPack,
  createJurisdictionControlPlaneSummary,
  createJurisdictionExportMetadata,
  createJurisdictionPackRegistry,
  demoJurisdictionPackCR,
  findJurisdictionOverclaimPhrases,
  mapJurisdictionResolutionToApproval,
  mapJurisdictionResolutionToEvidenceRequirements,
  resolveJurisdictionPacks,
  validateJurisdictionPack,
} from "../src/features/domain-policy-pack-runtime/jurisdiction";
import { buildResolutionInput } from "./jurisdiction-pack-test-helpers";

test("assertNoJurisdictionOverclaim throws on a prohibited phrase (this test is dedicated to the prohibited phrase list)", () => {
  for (const phrase of JURISDICTION_PROHIBITED_OVERCLAIM_PHRASES) {
    assert.throws(() => assertNoJurisdictionOverclaim({ summary: `This pack is ${phrase}.` }), JurisdictionOverclaimError);
  }
});

test("assertNoJurisdictionOverclaim does not throw on safe runtime vocabulary", () => {
  assert.doesNotThrow(() => assertNoJurisdictionOverclaim({ labels: JURISDICTION_SAFE_LABELS }));
});

test("findJurisdictionOverclaimPhrases returns an empty list for safe values", () => {
  assert.deepEqual(findJurisdictionOverclaimPhrases({ labels: JURISDICTION_SAFE_LABELS, disclaimer: "not_legal_advice" }), []);
});

// Sweep every runtime output type produced by a representative escalation
// scenario and assert none of them overclaim.
test("no jurisdiction runtime output overclaims: pack, validation, resolution, composition, approval, evidence, export, control plane", () => {
  const pack = counselReviewedJurisdictionPack();
  assertNoJurisdictionOverclaim(pack.metadata);
  assertNoJurisdictionOverclaim(pack);

  const validation = validateJurisdictionPack(pack);
  assertNoJurisdictionOverclaim(validation);

  const registry = createJurisdictionPackRegistry();
  registry.register(demoJurisdictionPackCR());

  const resolution = resolveJurisdictionPacks(
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "CR" },
      legalSensitivity: { legallySensitive: true, categories: ["contract_formation"] },
      requiredValidationStatus: ["counsel_reviewed"],
    }),
    registry
  );
  assertNoJurisdictionOverclaim(resolution);

  const composition = composeJurisdictionWithBaseline(pack, "aoc.global_legal_baseline.v1");
  assertNoJurisdictionOverclaim(composition);

  const approvalMapping = mapJurisdictionResolutionToApproval(resolution);
  assertNoJurisdictionOverclaim(approvalMapping);

  const evidenceRequirements = mapJurisdictionResolutionToEvidenceRequirements(resolution);
  assertNoJurisdictionOverclaim(evidenceRequirements);

  const exportMetadata = createJurisdictionExportMetadata(resolution);
  assertNoJurisdictionOverclaim(exportMetadata);

  const controlPlaneSummary = createJurisdictionControlPlaneSummary(resolution);
  assertNoJurisdictionOverclaim(controlPlaneSummary);
});

test("no jurisdiction runtime output overclaims across unknown/ambiguous/conflict/missing-pack scenarios", () => {
  const registry = createJurisdictionPackRegistry();

  const scenarios = [
    buildResolutionInput({ jurisdiction: { known: false }, legalSensitivity: { legallySensitive: true, categories: [] } }),
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "PA", ambiguous: true },
      legalSensitivity: { legallySensitive: true, categories: [] },
    }),
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "PA", conflictDetected: true },
      legalSensitivity: { legallySensitive: true, categories: [] },
    }),
    buildResolutionInput({
      jurisdiction: { known: true, countryCode: "PA" },
      legalSensitivity: { legallySensitive: true, categories: [] },
    }),
  ];

  for (const input of scenarios) {
    const resolution = resolveJurisdictionPacks(input, registry);
    assertNoJurisdictionOverclaim(resolution);
    assertNoJurisdictionOverclaim(mapJurisdictionResolutionToApproval(resolution));
    assertNoJurisdictionOverclaim(mapJurisdictionResolutionToEvidenceRequirements(resolution));
    assertNoJurisdictionOverclaim(createJurisdictionExportMetadata(resolution));
    assertNoJurisdictionOverclaim(createJurisdictionControlPlaneSummary(resolution));
  }
});
