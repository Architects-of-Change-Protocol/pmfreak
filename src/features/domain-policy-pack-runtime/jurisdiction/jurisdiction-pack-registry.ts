// AOC Jurisdiction Pack Runtime v1 — registry
//
// A specialization of the (future) Domain Policy Pack Runtime registry
// pattern for jurisdiction packs specifically. Registration is explicit
// dependency injection, not a hidden module-level singleton, matching the
// rest of this runtime's deterministic style: callers create a registry
// and pass it wherever it's needed.

import { validateJurisdictionPack } from "./jurisdiction-pack-validator";
import type { JurisdictionDescriptor, JurisdictionPack, JurisdictionValidationStatus, RegisteredJurisdictionPack } from "./jurisdiction-pack-types";

export type JurisdictionPackRegistry = {
  register(pack: JurisdictionPack): RegisteredJurisdictionPack;
  getById(id: string): RegisteredJurisdictionPack | undefined;
  all(): RegisteredJurisdictionPack[];
  findByCountryCode(countryCode: string): RegisteredJurisdictionPack[];
  findBySubdivision(countryCode: string, subdivisionCode: string): RegisteredJurisdictionPack[];
  findByMarketCode(marketCode: string): RegisteredJurisdictionPack[];
  findByValidationStatus(status: JurisdictionValidationStatus): RegisteredJurisdictionPack[];
  findActive(): RegisteredJurisdictionPack[];
  // Broad candidate lookup used by the resolver: matches on whichever
  // identifying fields the query descriptor provides. Does not imply any
  // of the returned packs are usable — a candidate may be expired,
  // superseded, or a demo-only validation status.
  findCandidatesForDescriptor(descriptor: JurisdictionDescriptor): RegisteredJurisdictionPack[];
};

function descriptorMatches(packJurisdiction: JurisdictionDescriptor, query: JurisdictionDescriptor): boolean {
  const identifiers: Array<[string | undefined, string | undefined]> = [
    [query.countryCode, packJurisdiction.countryCode],
    [query.subdivisionCode, packJurisdiction.subdivisionCode],
    [query.regionCode, packJurisdiction.regionCode],
    [query.marketCode, packJurisdiction.marketCode],
  ];

  let hasQueryIdentifier = false;
  for (const [queryValue, packValue] of identifiers) {
    if (queryValue === undefined) continue;
    hasQueryIdentifier = true;
    if (packValue !== queryValue) return false;
  }
  return hasQueryIdentifier;
}

export function createJurisdictionPackRegistry(): JurisdictionPackRegistry {
  const packs = new Map<string, JurisdictionPack>();

  return {
    register(pack) {
      const validation = validateJurisdictionPack(pack);
      if (!validation.valid) {
        throw new Error(`Cannot register jurisdiction pack "${pack.id}": ${validation.errors.join("; ")}`);
      }
      packs.set(pack.id, pack);
      return pack;
    },

    getById(id) {
      return packs.get(id);
    },

    all() {
      return [...packs.values()];
    },

    findByCountryCode(countryCode) {
      return [...packs.values()].filter((pack) => pack.jurisdiction.countryCode === countryCode);
    },

    findBySubdivision(countryCode, subdivisionCode) {
      return [...packs.values()].filter(
        (pack) => pack.jurisdiction.countryCode === countryCode && pack.jurisdiction.subdivisionCode === subdivisionCode
      );
    },

    findByMarketCode(marketCode) {
      return [...packs.values()].filter((pack) => pack.jurisdiction.marketCode === marketCode);
    },

    findByValidationStatus(status) {
      return [...packs.values()].filter((pack) => pack.validationStatus === status);
    },

    findActive() {
      return [...packs.values()].filter((pack) => pack.status === "active");
    },

    findCandidatesForDescriptor(descriptor) {
      return [...packs.values()].filter((pack) => descriptorMatches(pack.jurisdiction, descriptor));
    },
  };
}

// Thin wrapper matching the spec's named function signature. Prefer
// calling registry.register(pack) directly in new code.
export function registerJurisdictionPack(registry: JurisdictionPackRegistry, pack: JurisdictionPack): RegisteredJurisdictionPack {
  return registry.register(pack);
}
