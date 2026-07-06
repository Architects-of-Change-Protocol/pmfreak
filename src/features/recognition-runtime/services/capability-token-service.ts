import type { RecognitionCapabilityToken, RecognitionRuntimeContext } from "../domain";
import { UnknownCapabilityTokenError } from "../runtime/recognition-runtime-errors";

export type IssueCapabilityTokenInput = {
  id?: string;
  actorId: string;
  trustDomainId: string;
  passportId: string;
  capability: string;
  resourceScope: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export type CapabilityTokenService = {
  issueCapabilityToken(input: IssueCapabilityTokenInput): RecognitionCapabilityToken;
  getCapabilityToken(capabilityTokenId: string): RecognitionCapabilityToken | undefined;
  requireCapabilityToken(capabilityTokenId: string): RecognitionCapabilityToken;
  listTokensForActor(actorId: string): RecognitionCapabilityToken[];
  revokeCapabilityToken(capabilityTokenId: string): RecognitionCapabilityToken;
  isCapabilityTokenActive(token: RecognitionCapabilityToken, atInstant: string): boolean;
};

const isExpired = (token: RecognitionCapabilityToken, atInstant: string): boolean =>
  token.expiresAt !== undefined && token.expiresAt <= atInstant;

export function createCapabilityTokenService(context: RecognitionRuntimeContext): CapabilityTokenService {
  const tokens = new Map<string, RecognitionCapabilityToken>();

  const requireCapabilityToken = (capabilityTokenId: string): RecognitionCapabilityToken => {
    const token = tokens.get(capabilityTokenId);
    if (!token) throw new UnknownCapabilityTokenError(capabilityTokenId);
    return token;
  };

  return {
    issueCapabilityToken(input) {
      const id = input.id ?? context.ids.nextId("capability-token");
      const token: RecognitionCapabilityToken = {
        id,
        actorId: input.actorId,
        trustDomainId: input.trustDomainId,
        passportId: input.passportId,
        capability: input.capability,
        resourceScope: input.resourceScope,
        status: "active",
        issuedAt: context.clock.now(),
        expiresAt: input.expiresAt,
        metadata: input.metadata,
      };
      tokens.set(id, token);
      return token;
    },

    getCapabilityToken(capabilityTokenId) {
      return tokens.get(capabilityTokenId);
    },

    requireCapabilityToken,

    listTokensForActor(actorId) {
      return [...tokens.values()].filter((token) => token.actorId === actorId);
    },

    revokeCapabilityToken(capabilityTokenId) {
      const token = requireCapabilityToken(capabilityTokenId);
      const updated: RecognitionCapabilityToken = { ...token, status: "revoked", revokedAt: context.clock.now() };
      tokens.set(capabilityTokenId, updated);
      return updated;
    },

    isCapabilityTokenActive(token, atInstant) {
      if (token.status !== "active") return false;
      return !isExpired(token, atInstant);
    },
  };
}
