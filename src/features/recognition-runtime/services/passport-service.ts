import type { Passport, RecognitionRuntimeContext } from "../domain";
import { UnknownPassportError } from "../runtime/recognition-runtime-errors";

export type IssuePassportInput = {
  id?: string;
  actorId: string;
  trustDomainId: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type PassportService = {
  issuePassport(input: IssuePassportInput): Passport;
  getPassport(passportId: string): Passport | undefined;
  requirePassport(passportId: string): Passport;
  listPassportsForActor(actorId: string): Passport[];
  suspendPassport(passportId: string): Passport;
  revokePassport(passportId: string): Passport;
  isPassportActive(passport: Passport, atInstant: string): boolean;
};

const isExpired = (passport: Passport, atInstant: string): boolean =>
  passport.expiresAt !== undefined && passport.expiresAt <= atInstant;

export function createPassportService(context: RecognitionRuntimeContext): PassportService {
  const passports = new Map<string, Passport>();

  const requirePassport = (passportId: string): Passport => {
    const passport = passports.get(passportId);
    if (!passport) throw new UnknownPassportError(passportId);
    return passport;
  };

  return {
    issuePassport(input) {
      const id = input.id ?? context.ids.nextId("passport");
      const passport: Passport = {
        id,
        actorId: input.actorId,
        trustDomainId: input.trustDomainId,
        status: "active",
        issuedAt: context.clock.now(),
        expiresAt: input.expiresAt,
        metadata: input.metadata,
      };
      passports.set(id, passport);
      return passport;
    },

    getPassport(passportId) {
      return passports.get(passportId);
    },

    requirePassport,

    listPassportsForActor(actorId) {
      return [...passports.values()].filter((passport) => passport.actorId === actorId);
    },

    suspendPassport(passportId) {
      const passport = requirePassport(passportId);
      const updated: Passport = { ...passport, status: "suspended" };
      passports.set(passportId, updated);
      return updated;
    },

    revokePassport(passportId) {
      const passport = requirePassport(passportId);
      const updated: Passport = { ...passport, status: "revoked", revokedAt: context.clock.now() };
      passports.set(passportId, updated);
      return updated;
    },

    isPassportActive(passport, atInstant) {
      if (passport.status !== "active") return false;
      return !isExpired(passport, atInstant);
    },
  };
}
