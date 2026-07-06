import type { RecognitionRuntimeContext, TrustDomain } from "../domain";
import { DuplicateTrustDomainError, UnknownTrustDomainError } from "../runtime/recognition-runtime-errors";

export type CreateTrustDomainInput = {
  id?: string;
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type TrustDomainService = {
  createTrustDomain(input: CreateTrustDomainInput): TrustDomain;
  getTrustDomain(trustDomainId: string): TrustDomain | undefined;
  requireTrustDomain(trustDomainId: string): TrustDomain;
  listTrustDomains(): TrustDomain[];
  suspendTrustDomain(trustDomainId: string): TrustDomain;
};

export function createTrustDomainService(context: RecognitionRuntimeContext): TrustDomainService {
  const trustDomains = new Map<string, TrustDomain>();

  const requireTrustDomain = (trustDomainId: string): TrustDomain => {
    const trustDomain = trustDomains.get(trustDomainId);
    if (!trustDomain) throw new UnknownTrustDomainError(trustDomainId);
    return trustDomain;
  };

  return {
    createTrustDomain(input) {
      const id = input.id ?? context.ids.nextId("trust-domain");
      if (trustDomains.has(id)) throw new DuplicateTrustDomainError(id);

      const trustDomain: TrustDomain = {
        id,
        name: input.name,
        description: input.description,
        status: "active",
        createdAt: context.clock.now(),
        metadata: input.metadata,
      };
      trustDomains.set(id, trustDomain);
      return trustDomain;
    },

    getTrustDomain(trustDomainId) {
      return trustDomains.get(trustDomainId);
    },

    requireTrustDomain,

    listTrustDomains() {
      return [...trustDomains.values()];
    },

    suspendTrustDomain(trustDomainId) {
      const trustDomain = requireTrustDomain(trustDomainId);
      const suspended: TrustDomain = { ...trustDomain, status: "suspended" };
      trustDomains.set(trustDomainId, suspended);
      return suspended;
    },
  };
}
