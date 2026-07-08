// AOC Jurisdiction Pack Runtime v1 — resolution
//
// resolveJurisdictionPacks never decides that an action is legally
// compliant. It only decides whether the jurisdiction-pack preconditions
// declared by the caller (known/unambiguous/unconflicted jurisdiction,
// required baseline packs present, required validation status met) are
// satisfied enough for the workflow to continue — and if not, which
// review/evidence is required next.

import { JURISDICTION_REASON_CODE_TO_EVIDENCE_TYPES } from "./jurisdiction-pack-reason-codes";
import type { JurisdictionPackRegistry } from "./jurisdiction-pack-registry";
import {
  JURISDICTION_SAFE_METADATA,
  JURISDICTION_VALIDATION_STATUS_RANK,
  pickMoreSevereDecision,
  type JurisdictionDescriptor,
  type JurisdictionEvidenceRequirement,
  type JurisdictionPackResolution,
  type JurisdictionPackResolutionInput,
  type JurisdictionReviewReasonCode,
  type JurisdictionReviewRequirement,
  type JurisdictionReviewType,
  type JurisdictionRuntimeDecision,
  type JurisdictionValidationStatus,
} from "./jurisdiction-pack-types";

function descriptorRef(descriptor: JurisdictionDescriptor): string {
  if (descriptor.countryCode && descriptor.subdivisionCode) {
    return `jurisdiction:${descriptor.countryCode}-${descriptor.subdivisionCode}`;
  }
  if (descriptor.countryCode) return `jurisdiction:${descriptor.countryCode}`;
  if (descriptor.marketCode) return `jurisdiction:market:${descriptor.marketCode}`;
  if (descriptor.regionCode) return `jurisdiction:region:${descriptor.regionCode}`;
  return "jurisdiction:unknown";
}

function validationStatusSatisfies(actual: JurisdictionValidationStatus, required: JurisdictionValidationStatus): boolean {
  const actualRank = JURISDICTION_VALIDATION_STATUS_RANK[actual];
  if (actualRank < 0) return false; // expired/superseded never satisfy anything
  return actualRank >= JURISDICTION_VALIDATION_STATUS_RANK[required];
}

export function resolveJurisdictionPacks(
  input: JurisdictionPackResolutionInput,
  registry: JurisdictionPackRegistry
): JurisdictionPackResolution {
  const jurisdictionKnown = input.jurisdiction.known;
  const jurisdictionAmbiguous = Boolean(input.jurisdiction.ambiguous);
  const jurisdictionConflictDetected = Boolean(input.jurisdiction.conflictDetected);
  const legallySensitive = Boolean(input.legalSensitivity?.legallySensitive);
  const requiredValidationStatus = input.requiredValidationStatus ?? [];

  // An explicit requiredValidationStatus is itself a signal that
  // jurisdiction-pack matching matters here, even if the caller didn't
  // also set legalSensitivity.
  const requiresJurisdictionPackMatch = legallySensitive || requiredValidationStatus.length > 0;

  const candidates = registry.findCandidatesForDescriptor(input.jurisdiction);
  const candidatePackIds = [...candidates.map((pack) => pack.id)].sort();

  const requiredBaselinePackIds = input.requiredBaselinePackIds ?? [];
  const missingBaselinePackIds = requiredBaselinePackIds.filter((id) => {
    const pack = registry.getById(id);
    return !pack || pack.status !== "active";
  });

  const selectedPackIds: string[] = [];
  const missingPackIds: string[] = [...missingBaselinePackIds];
  const requiredReviews: JurisdictionReviewRequirement[] = [];
  const requiredEvidence: JurisdictionEvidenceRequirement[] = [];
  let validationStatusSatisfied = true;
  let decision: JurisdictionRuntimeDecision = "allow";

  const escalate = (next: JurisdictionRuntimeDecision) => {
    decision = pickMoreSevereDecision(decision, next);
  };

  const requireReview = (reviewType: JurisdictionReviewType, reasonCode: JurisdictionReviewReasonCode) => {
    requiredReviews.push({
      id: `review-${reasonCode}`,
      reviewType,
      required: true,
      reasonCode,
    });
    for (const evidenceType of JURISDICTION_REASON_CODE_TO_EVIDENCE_TYPES[reasonCode]) {
      requiredEvidence.push({
        id: `evidence-${reasonCode}-${evidenceType}`,
        evidenceType,
        required: true,
      });
    }
  };

  if (missingBaselinePackIds.length > 0) {
    escalate("hold");
  }

  if (requiresJurisdictionPackMatch) {
    if (jurisdictionConflictDetected) {
      escalate("require_legal_review");
      requireReview("legal_review", "jurisdiction_conflict");
      validationStatusSatisfied = false;
    } else if (jurisdictionAmbiguous) {
      escalate("require_legal_review");
      requireReview("legal_review", "jurisdiction_ambiguous");
      validationStatusSatisfied = false;
    } else if (!jurisdictionKnown) {
      escalate("require_legal_review");
      requireReview("legal_review", "jurisdiction_unknown");
      validationStatusSatisfied = false;
    } else {
      const activeCandidates = candidates.filter((pack) => pack.status === "active");

      if (activeCandidates.length === 0) {
        validationStatusSatisfied = false;
        if (candidates.length > 0) {
          // Candidates exist for this jurisdiction, but none are usable
          // (expired, superseded, draft, deprecated, or disabled).
          escalate("require_legal_review");
          requireReview("legal_review", "jurisdiction_pack_expired");
          missingPackIds.push(...candidates.map((pack) => pack.id));
        } else {
          escalate("require_legal_review");
          requireReview("legal_review", "jurisdiction_pack_missing");
          missingPackIds.push(descriptorRef(input.jurisdiction));
        }
      } else {
        const selected = [...activeCandidates].sort((a, b) => a.id.localeCompare(b.id))[0];
        selectedPackIds.push(selected.id);

        const unsatisfied = requiredValidationStatus.filter(
          (status) => !validationStatusSatisfies(selected.validationStatus, status)
        );

        if (unsatisfied.length > 0) {
          validationStatusSatisfied = false;
          if (unsatisfied.includes("counsel_reviewed") || unsatisfied.includes("counsel_attested")) {
            escalate("require_counsel_review");
            requireReview(
              "counsel_review",
              selected.validationStatus === "demo_baseline" ? "jurisdiction_pack_demo_only" : "counsel_review_missing"
            );
          } else {
            escalate("require_customer_validation");
            requireReview("customer_validation", "customer_validation_missing");
          }
        }
      }
    }
  }

  return {
    actionId: input.actionId,
    agentId: input.agentId,

    jurisdictionKnown,
    jurisdictionAmbiguous,
    jurisdictionConflictDetected,

    selectedPackIds,
    missingPackIds,
    candidatePackIds,

    validationStatusSatisfied,

    requiredReviews,
    requiredEvidence,

    decision,

    metadata: JURISDICTION_SAFE_METADATA,

    evaluatedAt: input.requestedAt,
  };
}
