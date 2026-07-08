// AOC Jurisdiction Pack Runtime v1 — pack validation
//
// validateJurisdictionPack is defense in depth: createJurisdictionPack
// already forces safe fields, but this function must independently reject
// any JurisdictionPack — however it was constructed — that overclaims.

import { findJurisdictionOverclaimPhrases } from "./jurisdiction-pack-no-overclaim";
import type { JurisdictionPack, JurisdictionPackValidationResult } from "./jurisdiction-pack-types";

export function validateJurisdictionPack(pack: JurisdictionPack): JurisdictionPackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!pack.id || pack.id.trim().length === 0) {
    errors.push("Jurisdiction pack is missing an id.");
  }
  if (!pack.version || pack.version.trim().length === 0) {
    errors.push("Jurisdiction pack is missing a version.");
  }
  if (pack.kind !== "jurisdiction_pack") {
    errors.push(`Jurisdiction pack kind must be "jurisdiction_pack", got "${String(pack.kind)}".`);
  }
  if (!pack.jurisdiction) {
    errors.push("Jurisdiction pack is missing a jurisdiction descriptor.");
  }

  if (!pack.metadata) {
    errors.push("Jurisdiction pack is missing metadata.");
  } else {
    if (pack.metadata.requiredDisclaimer !== "not_legal_advice") {
      errors.push("Jurisdiction pack metadata is missing the required not_legal_advice disclaimer.");
    }
    if (pack.metadata.policyModelStatus !== "partial_policy_model") {
      errors.push(
        "Jurisdiction pack metadata must declare policyModelStatus = partial_policy_model (completeness overclaim)."
      );
    }
    if ((pack.metadata.complianceClaimed as unknown) !== false) {
      errors.push("Jurisdiction pack metadata must not set complianceClaimed = true (compliance certification overclaim).");
    }
    if ((pack.metadata.jurisdictionalComplianceClaimed as unknown) !== false) {
      errors.push(
        "Jurisdiction pack metadata must not set jurisdictionalComplianceClaimed = true (jurisdictional compliance overclaim)."
      );
    }
    if (!pack.metadata.sourceStatus) {
      errors.push("Jurisdiction pack metadata is missing sourceStatus.");
    } else if (pack.metadata.sourceStatus !== pack.validationStatus) {
      errors.push(
        `Jurisdiction pack metadata.sourceStatus ("${pack.metadata.sourceStatus}") does not match validationStatus ("${pack.validationStatus}"). ` +
          "A pack must not claim a stronger validation status via metadata than its declared validationStatus (e.g. demo_baseline must not be marked counsel_reviewed)."
      );
    }
  }

  if (!pack.scope) {
    errors.push("Jurisdiction pack is missing a scope.");
  } else {
    if ((pack.scope.legalAdvice as unknown) !== false) {
      errors.push("Jurisdiction pack scope must not set legalAdvice = true (legal advice overclaim).");
    }
    if ((pack.scope.complianceCertification as unknown) !== false) {
      errors.push("Jurisdiction pack scope must not set complianceCertification = true (compliance certification overclaim).");
    }
    if ((pack.scope.completenessClaimed as unknown) !== false) {
      errors.push("Jurisdiction pack scope must not set completenessClaimed = true (completeness overclaim).");
    }
  }

  if (!pack.validationStatus) {
    errors.push("Jurisdiction pack is missing a validationStatus.");
  }

  if (pack.status === "active" && (pack.validationStatus === "expired" || pack.validationStatus === "superseded")) {
    errors.push(
      `Jurisdiction pack cannot be status = "active" while validationStatus is "${pack.validationStatus}" — expired/superseded packs are not active.`
    );
  }

  if (pack.scope?.jurisdictionSpecific && (pack.requiredBaselinePackIds ?? []).length === 0) {
    warnings.push(
      "Jurisdiction-specific pack does not declare any required baseline pack dependency (e.g. aoc.global_legal_baseline.v1)."
    );
  }

  const overclaimPhrases = findJurisdictionOverclaimPhrases({
    name: pack.name,
    exportLabels: pack.exportLabels,
    controlPlaneLabels: pack.controlPlaneLabels,
    notes: pack.metadata?.notes,
    requirements: (pack.requirements ?? []).map((requirement) => ({
      title: requirement.title,
      description: requirement.description,
    })),
  });
  if (overclaimPhrases.length > 0) {
    errors.push(`Jurisdiction pack contains prohibited overclaim language: ${overclaimPhrases.join(", ")}.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
