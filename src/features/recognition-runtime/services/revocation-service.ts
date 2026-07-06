// AOC Recognition Runtime — cascading revocation.
//
// Revoking an actor must also invalidate everything issued to that actor:
// their passports, and every capability token issued against those
// passports. A capability token can never outlive the passport or actor it
// depends on.

import type { ActorRegistryService } from "./actor-registry-service";
import type { PassportService } from "./passport-service";
import type { CapabilityTokenService } from "./capability-token-service";

export type RevocationServiceDeps = {
  actorRegistry: ActorRegistryService;
  passports: PassportService;
  capabilityTokens: CapabilityTokenService;
};

export type RevocationService = {
  revokeActor(actorId: string): void;
  revokePassport(passportId: string): void;
  revokeCapabilityToken(capabilityTokenId: string): void;
};

export function createRevocationService(deps: RevocationServiceDeps): RevocationService {
  const { actorRegistry, passports, capabilityTokens } = deps;

  const revokeActiveTokensForPassport = (actorId: string, passportId: string) => {
    for (const token of capabilityTokens.listTokensForActor(actorId)) {
      if (token.passportId === passportId && token.status === "active") {
        capabilityTokens.revokeCapabilityToken(token.id);
      }
    }
  };

  return {
    revokeActor(actorId) {
      actorRegistry.revokeActor(actorId);
      for (const passport of passports.listPassportsForActor(actorId)) {
        if (passport.status !== "revoked") passports.revokePassport(passport.id);
        revokeActiveTokensForPassport(actorId, passport.id);
      }
    },

    revokePassport(passportId) {
      const passport = passports.requirePassport(passportId);
      passports.revokePassport(passportId);
      revokeActiveTokensForPassport(passport.actorId, passportId);
    },

    revokeCapabilityToken(capabilityTokenId) {
      capabilityTokens.revokeCapabilityToken(capabilityTokenId);
    },
  };
}
