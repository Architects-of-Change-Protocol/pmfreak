import type { Actor, ActionRequest, AuditEvent, Passport, RecognitionCapabilityToken, RecognitionDecision, RecognitionRequirementRule, RecognitionRuntimeContext, TrustDomain } from "../domain";
import {
  createActorRegistryService,
  createAuditLedger,
  createCapabilityTokenService,
  createPassportService,
  createRequirementRuleService,
  createRevocationService,
  createTrustDomainService,
  type ActorRegistryService,
  type AuditLedger,
  type CapabilityTokenService,
  type CreateTrustDomainInput,
  type IssueCapabilityTokenInput,
  type IssuePassportInput,
  type PassportService,
  type RegisterActorInput,
  type RegisterRequirementRuleInput,
  type RequirementRuleService,
  type TrustDomainService,
} from "../services";
import { createRecognitionVerifier } from "./recognition-verifier";

export type AocRecognitionRuntime = {
  createTrustDomain(input: CreateTrustDomainInput): TrustDomain;
  registerActor(input: RegisterActorInput): Actor;
  issuePassport(input: IssuePassportInput): Passport;
  issueCapabilityToken(input: IssueCapabilityTokenInput): RecognitionCapabilityToken;
  registerRequirementRule(input: RegisterRequirementRuleInput): RecognitionRequirementRule;

  suspendActor(actorId: string): Actor | undefined;
  revokeActor(actorId: string): void;
  revokePassport(passportId: string): void;
  revokeCapabilityToken(capabilityTokenId: string): void;

  verifyActionRequest(actionRequest: ActionRequest): RecognitionDecision;

  getAuditTrail(actionRequestId: string): AuditEvent[];
  getAuditEventsForTrustDomain(trustDomainId: string): AuditEvent[];

  services: {
    trustDomains: TrustDomainService;
    actorRegistry: ActorRegistryService;
    passports: PassportService;
    capabilityTokens: CapabilityTokenService;
    requirementRules: RequirementRuleService;
    auditLedger: AuditLedger;
  };
};

export function createAocRecognitionRuntime(context: RecognitionRuntimeContext): AocRecognitionRuntime {
  const trustDomains = createTrustDomainService(context);
  const actorRegistry = createActorRegistryService(context);
  const passports = createPassportService(context);
  const capabilityTokens = createCapabilityTokenService(context);
  const requirementRules = createRequirementRuleService(context);
  const auditLedger = createAuditLedger(context);
  const revocation = createRevocationService({ actorRegistry, passports, capabilityTokens });
  const verifier = createRecognitionVerifier({
    context,
    trustDomains,
    actorRegistry,
    passports,
    capabilityTokens,
    requirementRules,
    auditLedger,
  });

  return {
    createTrustDomain(input) {
      const trustDomain = trustDomains.createTrustDomain(input);
      auditLedger.recordEvent({
        type: "trust_domain_created",
        trustDomainId: trustDomain.id,
        payload: { name: trustDomain.name },
      });
      return trustDomain;
    },

    registerActor(input) {
      const actor = actorRegistry.registerActor(input);
      auditLedger.recordEvent({
        type: "actor_registered",
        trustDomainId: actor.trustDomainId,
        actorId: actor.id,
        payload: { actorType: actor.type, displayName: actor.displayName },
      });
      return actor;
    },

    issuePassport(input) {
      const passport = passports.issuePassport(input);
      auditLedger.recordEvent({
        type: "passport_issued",
        trustDomainId: passport.trustDomainId,
        actorId: passport.actorId,
        payload: { passportId: passport.id, expiresAt: passport.expiresAt ?? null },
      });
      return passport;
    },

    issueCapabilityToken(input) {
      const token = capabilityTokens.issueCapabilityToken(input);
      auditLedger.recordEvent({
        type: "capability_token_issued",
        trustDomainId: token.trustDomainId,
        actorId: token.actorId,
        payload: { capabilityTokenId: token.id, capability: token.capability, resourceScope: token.resourceScope },
      });
      return token;
    },

    registerRequirementRule(input) {
      return requirementRules.registerRule(input);
    },

    suspendActor(actorId) {
      const actor = actorRegistry.suspendActor(actorId);
      if (actor) {
        auditLedger.recordEvent({
          type: "actor_suspended",
          trustDomainId: actor.trustDomainId,
          actorId: actor.id,
          payload: {},
        });
      }
      return actor;
    },

    revokeActor(actorId) {
      const actor = actorRegistry.getActor(actorId);
      revocation.revokeActor(actorId);
      if (actor) {
        auditLedger.recordEvent({
          type: "actor_revoked",
          trustDomainId: actor.trustDomainId,
          actorId,
          payload: {},
        });
      }
    },

    revokePassport(passportId) {
      const passport = passports.getPassport(passportId);
      revocation.revokePassport(passportId);
      if (passport) {
        auditLedger.recordEvent({
          type: "passport_revoked",
          trustDomainId: passport.trustDomainId,
          actorId: passport.actorId,
          payload: { passportId },
        });
      }
    },

    revokeCapabilityToken(capabilityTokenId) {
      const token = capabilityTokens.getCapabilityToken(capabilityTokenId);
      revocation.revokeCapabilityToken(capabilityTokenId);
      if (token) {
        auditLedger.recordEvent({
          type: "capability_token_revoked",
          trustDomainId: token.trustDomainId,
          actorId: token.actorId,
          payload: { capabilityTokenId },
        });
      }
    },

    verifyActionRequest(actionRequest) {
      return verifier.verify(actionRequest);
    },

    getAuditTrail(actionRequestId) {
      return auditLedger.getEventsForActionRequest(actionRequestId);
    },

    getAuditEventsForTrustDomain(trustDomainId) {
      return auditLedger.getEventsForTrustDomain(trustDomainId);
    },

    services: { trustDomains, actorRegistry, passports, capabilityTokens, requirementRules, auditLedger },
  };
}
