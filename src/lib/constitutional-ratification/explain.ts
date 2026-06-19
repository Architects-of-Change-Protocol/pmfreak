import type { ConstitutionalRatificationExplanation } from "./types";

export function explainConstitutionalRatification(): ConstitutionalRatificationExplanation {
  return {
    overview:
      "The Constitutional Ratification Framework ensures that Constitutions, Amendments, and Decisions acquire formal legitimacy through explicit approval, ratification, and acceptance processes. Existence alone does not confer legitimacy — formal evidence of acceptance by authorised parties is required.",

    ratifiableEntities: ["constitution", "amendment", "decision"],

    signatureAuthorities: [
      "sponsor",
      "project_manager",
      "client",
      "steering_committee",
      "governance_board",
      "product_owner",
      "architect",
      "technical_lead",
      "external_approver",
    ],

    signatureStates: ["pending", "signed", "rejected", "expired", "withdrawn"],

    legitimacyStates: ["unratified", "partially_ratified", "ratified", "rejected", "expired"],

    nonRepudiation: {
      description:
        "Every signature record captures who approved, what they approved, when they approved it, and under which version. The signature hash encodes entity_id, entity_version, authority_id, and timestamp, making the approval conditions permanently reconstructible.",
      guarantees: [
        "Identity — the authority_id and authority_type are recorded immutably.",
        "Intention — the act of signing is a formal confirmation of consent.",
        "Consentimiento — a signed record cannot be erased; only withdrawn.",
        "Moment — signed_at is recorded at the instant of signing.",
        "Version binding — entity_version pins the signature to the exact state of the entity at signing time.",
        "Hash integrity — the signature_hash can be independently recomputed to verify no tampering occurred.",
      ],
    },

    ratificationProcess: [
      "1. A signature is requested via requestSignature(), creating a pending signature record and a signature request.",
      "2. The designated authority signs via signEntity(), which generates a signature hash and records signed_at.",
      "3. Alternatively, the authority rejects via rejectSignature() (terminal) or the request expires via expireSignature().",
      "4. A signed authority may withdraw via withdrawSignature(); a withdrawn signature does not count toward ratification.",
      "5. validateRatification() checks that the minimum_signatures threshold is met and all required_authorities have signed.",
      "6. ratifyEntity() calls validateRatification() internally, emits CONSTITUTIONAL_ENTITY_RATIFIED on success, or CONSTITUTIONAL_RATIFICATION_FAILED on failure.",
      "7. calculateLegitimacyStatus() produces a point-in-time LegitimacyAssessment with status: unratified | partially_ratified | ratified | rejected | expired.",
    ],

    hashingDescription:
      "generateSignatureHash() produces a 128-bit-wide deterministic content hash from entity_type, entity_id, entity_version, authority_type, authority_id, and timestamp using four chained FNV-1a(32) passes. The output is prefixed with 'sha-sig-' for identification. The same inputs always produce the same hash, enabling future reconstruction and verification of signing conditions.",

    policies:
      "Ratification policies (constitutional_ratification_policies) define per-entity-type governance: minimum_signatures is the floor count of signed signatures required; required_authorities lists authority_types that must be present; allow_unanimous_override allows a fully-signed set to bypass the minimum_signatures floor. Policies are upserted per workspace per entity type.",

    auditEvents: [
      "CONSTITUTIONAL_SIGNATURE_REQUESTED",
      "CONSTITUTIONAL_SIGNATURE_SIGNED",
      "CONSTITUTIONAL_SIGNATURE_REJECTED",
      "CONSTITUTIONAL_SIGNATURE_WITHDRAWN",
      "CONSTITUTIONAL_SIGNATURE_EXPIRED",
      "CONSTITUTIONAL_ENTITY_RATIFIED",
      "CONSTITUTIONAL_RATIFICATION_FAILED",
      "CONSTITUTIONAL_LEGITIMACY_UPDATED",
    ],

    businessRules: [
      "Rule 1: Every signature must belong to a ratifiable entity (constitution, amendment, decision).",
      "Rule 2: The same authority cannot sign the same entity twice; a duplicate request returns a governance_violation.",
      "Rule 3: A rejected signature is terminal — it cannot transition to any other status.",
      "Rule 4: A withdrawn signature does not count toward ratification threshold.",
      "Rule 5: Ratification requires fulfilling the policy: minimum_signatures signed and all required_authorities present.",
      "Rule 6: Every signature state transition emits an audit event to platform_events.",
      "Rule 7: Every ratification attempt (success or failure) emits an audit event.",
      "Rule 8: Workspace isolation is enforced at the database layer via RLS and in all service calls via workspace_id scoping.",
      "Rule 9: Every signature records entity_version to bind the approval to the exact entity state.",
      "Rule 10: The signature_hash is derived deterministically from entity and authority metadata, enabling historical reconstruction.",
    ],
  };
}
