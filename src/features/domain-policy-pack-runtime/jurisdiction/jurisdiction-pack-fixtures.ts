// AOC Jurisdiction Pack Runtime v1 — test fixtures
//
// Every fixture here is demo_only / not_legal_advice / partial_policy_model
// / not_compliance_certification and encodes zero real jurisdictional law.
// The CR/PA/US-DE country codes exist only to exercise descriptor matching
// (country / subdivision / market lookups) — they carry no legal content.
//
// Do not add real jurisdiction rules to this file. If you're tempted to,
// that belongs in a future, separately-reviewed jurisdiction pack, not in
// this runtime's fixtures.

import { createJurisdictionPack } from "./jurisdiction-pack-factory";
import { createJurisdictionPackRegistry, type JurisdictionPackRegistry } from "./jurisdiction-pack-registry";
import type { JurisdictionPack } from "./jurisdiction-pack-types";

export const GLOBAL_BASELINE_PACK_ID = "aoc.global_legal_baseline.v1";

const baseFixtureFields = {
  requiredBaselinePackIds: [GLOBAL_BASELINE_PACK_ID],
  extendsPackIds: [GLOBAL_BASELINE_PACK_ID],
};

export function demoJurisdictionPackCR(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.demo.v1",
    name: "Demo jurisdiction awareness pack (CR) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "demo_baseline",
    jurisdiction: { countryCode: "CR", known: true },
    ...baseFixtureFields,
  });
}

export function demoJurisdictionPackPA(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.pa.demo.v1",
    name: "Demo jurisdiction awareness pack (PA) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "demo_baseline",
    jurisdiction: { countryCode: "PA", known: true },
    ...baseFixtureFields,
  });
}

export function demoJurisdictionPackUSDE(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.us-de.demo.v1",
    name: "Demo jurisdiction awareness pack (US-DE) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "demo_baseline",
    jurisdiction: { countryCode: "US", subdivisionCode: "DE", known: true },
    ...baseFixtureFields,
  });
}

export function customerProvidedJurisdictionPack(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.customer-provided.v1",
    name: "Customer-provided jurisdiction pack (CR) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "customer_provided",
    jurisdiction: { countryCode: "CR", known: true },
    ...baseFixtureFields,
  });
}

export function customerValidatedJurisdictionPack(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.customer-validated.v1",
    name: "Customer-validated jurisdiction pack (CR) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "customer_validated",
    jurisdiction: { countryCode: "CR", known: true },
    ...baseFixtureFields,
  });
}

export function counselReviewedJurisdictionPack(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.counsel-reviewed.v1",
    name: "Counsel-reviewed jurisdiction pack (CR) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "counsel_reviewed",
    jurisdiction: { countryCode: "CR", known: true },
    metadata: { reviewedBy: "fixture-outside-counsel", reviewedAt: "2026-01-01T00:00:00.000Z" },
    ...baseFixtureFields,
  });
}

export function counselAttestedJurisdictionPack(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.counsel-attested.v1",
    name: "Counsel-attested jurisdiction pack (CR) — fixture only",
    version: "1.0.0",
    status: "active",
    validationStatus: "counsel_attested",
    jurisdiction: { countryCode: "CR", known: true },
    metadata: { reviewedBy: "fixture-outside-counsel", reviewedAt: "2026-01-01T00:00:00.000Z" },
    ...baseFixtureFields,
  });
}

export function expiredJurisdictionPack(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.expired.v1",
    name: "Expired jurisdiction pack (CR) — fixture only",
    version: "1.0.0",
    status: "expired",
    validationStatus: "counsel_reviewed",
    jurisdiction: { countryCode: "CR", known: true },
    ...baseFixtureFields,
  });
}

export function supersededJurisdictionPack(): JurisdictionPack {
  return createJurisdictionPack({
    id: "fixture.jurisdiction.cr.superseded.v1",
    name: "Superseded jurisdiction pack (CR) — fixture only",
    version: "1.0.0",
    status: "superseded",
    validationStatus: "counsel_reviewed",
    jurisdiction: { countryCode: "CR", known: true },
    metadata: { supersededByPackId: "fixture.jurisdiction.cr.counsel-reviewed.v2" },
    ...baseFixtureFields,
  });
}

// Registers the CR/PA/US-DE demo packs into a fresh registry. Tests that
// need a specific validation-status pack for a given descriptor build
// their own single-pack registry instead of relying on this bundle.
export function buildDemoJurisdictionPackRegistry(): JurisdictionPackRegistry {
  const registry = createJurisdictionPackRegistry();
  registry.register(demoJurisdictionPackCR());
  registry.register(demoJurisdictionPackPA());
  registry.register(demoJurisdictionPackUSDE());
  return registry;
}
