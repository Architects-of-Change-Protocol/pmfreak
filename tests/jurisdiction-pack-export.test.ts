import test from "node:test";
import assert from "node:assert/strict";

import {
  JURISDICTION_SAFE_METADATA,
  createJurisdictionControlPlaneSummary,
  createJurisdictionExportMetadata,
  mapJurisdictionResolutionToApproval,
  mapJurisdictionResolutionToEvidenceRequirements,
  type JurisdictionPackResolution,
} from "../src/features/domain-policy-pack-runtime/jurisdiction";

function buildResolution(overrides: Partial<JurisdictionPackResolution> = {}): JurisdictionPackResolution {
  return {
    actionId: "action-1",
    agentId: "agent-1",
    jurisdictionKnown: true,
    jurisdictionAmbiguous: false,
    jurisdictionConflictDetected: false,
    selectedPackIds: [],
    missingPackIds: [],
    candidatePackIds: [],
    validationStatusSatisfied: true,
    requiredReviews: [],
    requiredEvidence: [],
    decision: "allow",
    metadata: JURISDICTION_SAFE_METADATA,
    evaluatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Test 21: maps legal review decision to Approval Runtime
test("mapJurisdictionResolutionToApproval maps require_legal_review to a legal_review requirement", () => {
  const resolution = buildResolution({
    decision: "require_legal_review",
    jurisdictionKnown: false,
    requiredReviews: [{ id: "review-1", reviewType: "legal_review", required: true, reasonCode: "jurisdiction_unknown" }],
  });

  const mapping = mapJurisdictionResolutionToApproval(resolution);

  assert.ok(mapping.approvalRequirements.some((requirement) => requirement.reviewType === "legal_review"));
  assert.equal(mapping.enforcementAction, "require_approval");
});

// Test 22: maps counsel review decision to Approval Runtime
test("mapJurisdictionResolutionToApproval maps require_counsel_review to a counsel_review requirement", () => {
  const resolution = buildResolution({
    decision: "require_counsel_review",
    requiredReviews: [
      { id: "review-1", reviewType: "counsel_review", required: true, reasonCode: "counsel_review_missing" },
    ],
  });

  const mapping = mapJurisdictionResolutionToApproval(resolution);

  assert.ok(mapping.approvalRequirements.some((requirement) => requirement.reviewType === "counsel_review"));
});

// Test 23: maps missing jurisdiction evidence to Evidence Runtime shape
test("mapJurisdictionResolutionToEvidenceRequirements maps jurisdiction_unknown / jurisdiction_pack_missing to evidence source types", () => {
  const unknownResolution = buildResolution({
    decision: "require_legal_review",
    jurisdictionKnown: false,
    requiredReviews: [{ id: "review-1", reviewType: "legal_review", required: true, reasonCode: "jurisdiction_unknown" }],
  });
  const unknownEvidence = mapJurisdictionResolutionToEvidenceRequirements(unknownResolution);
  assert.ok(unknownEvidence.some((requirement) => requirement.evidenceType === "jurisdiction_basis_source"));

  const missingPackResolution = buildResolution({
    decision: "require_legal_review",
    missingPackIds: ["jurisdiction:CR"],
    requiredReviews: [
      { id: "review-2", reviewType: "legal_review", required: true, reasonCode: "jurisdiction_pack_missing" },
    ],
  });
  const missingPackEvidence = mapJurisdictionResolutionToEvidenceRequirements(missingPackResolution);
  assert.ok(missingPackEvidence.some((requirement) => requirement.evidenceType === "customer_policy_source"));
});

// Test 24: creates export metadata safely
test("createJurisdictionExportMetadata includes action/agent/pack/decision/review/evidence info with safe metadata", () => {
  const resolution = buildResolution({
    decision: "require_counsel_review",
    missingPackIds: ["jurisdiction:CR"],
    requiredReviews: [
      { id: "review-1", reviewType: "counsel_review", required: true, reasonCode: "counsel_review_missing" },
    ],
    requiredEvidence: [{ id: "evidence-1", evidenceType: "counsel_review_record", required: true }],
  });

  const exportMetadata = createJurisdictionExportMetadata(resolution);

  assert.equal(exportMetadata.actionId, "action-1");
  assert.equal(exportMetadata.agentId, "agent-1");
  assert.deepEqual(exportMetadata.missingPackIds, ["jurisdiction:CR"]);
  assert.equal(exportMetadata.decision, "require_counsel_review");
  assert.ok(exportMetadata.requiredReviewTypes.includes("counsel_review"));
  assert.ok(exportMetadata.requiredEvidenceTypes.includes("counsel_review_record"));
  assert.equal(exportMetadata.requiredDisclaimer, "not_legal_advice");
  assert.equal(exportMetadata.policyModelStatus, "partial_policy_model");
  assert.equal(exportMetadata.complianceClaimed, false);
  assert.equal(exportMetadata.jurisdictionalComplianceClaimed, false);
});

// Test 25: export metadata does not overclaim
test("createJurisdictionExportMetadata never includes prohibited overclaim phrases", async () => {
  const { findJurisdictionOverclaimPhrases } = await import("../src/features/domain-policy-pack-runtime/jurisdiction");

  const resolution = buildResolution({
    decision: "require_counsel_review",
    missingPackIds: ["jurisdiction:CR"],
    requiredReviews: [
      { id: "review-1", reviewType: "counsel_review", required: true, reasonCode: "counsel_review_missing" },
    ],
  });

  const exportMetadata = createJurisdictionExportMetadata(resolution);
  assert.deepEqual(findJurisdictionOverclaimPhrases(exportMetadata), []);
});

// Test 26: Control Plane summary uses safe labels
test("createJurisdictionControlPlaneSummary reports safe labels for a missing jurisdiction pack", () => {
  const resolution = buildResolution({
    decision: "require_legal_review",
    missingPackIds: ["jurisdiction:CR"],
    requiredReviews: [
      { id: "review-1", reviewType: "legal_review", required: true, reasonCode: "jurisdiction_pack_missing" },
    ],
  });

  const summary = createJurisdictionControlPlaneSummary(resolution);

  assert.equal(summary.packStatusLabel, "missing");
  for (const label of ["Jurisdiction awareness", "Not legal advice", "Partial policy model", "No jurisdiction-specific compliance claimed", "Missing jurisdiction pack"]) {
    assert.ok(summary.safeLabels.includes(label as (typeof summary.safeLabels)[number]), `expected safe label "${label}"`);
  }
});

// Test 27: Control Plane summary does not overclaim
test("createJurisdictionControlPlaneSummary never includes prohibited overclaim labels", async () => {
  const { findJurisdictionOverclaimPhrases } = await import("../src/features/domain-policy-pack-runtime/jurisdiction");

  const resolutions = [
    buildResolution({ decision: "allow" }),
    buildResolution({ decision: "hold", missingPackIds: ["aoc.global_legal_baseline.v1"] }),
    buildResolution({
      decision: "require_counsel_review",
      requiredReviews: [
        { id: "review-1", reviewType: "counsel_review", required: true, reasonCode: "counsel_review_missing" },
      ],
    }),
    buildResolution({ decision: "require_legal_review", jurisdictionConflictDetected: true }),
  ];

  for (const resolution of resolutions) {
    const summary = createJurisdictionControlPlaneSummary(resolution);
    assert.deepEqual(findJurisdictionOverclaimPhrases(summary), []);
    for (const badLabel of ["Legal compliance passed", "Compliant with law", "Fully legal", "Certified compliant", "Regulatory approved"]) {
      assert.ok(!summary.safeLabels.includes(badLabel as (typeof summary.safeLabels)[number]));
    }
  }
});
