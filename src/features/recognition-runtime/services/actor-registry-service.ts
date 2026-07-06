import type { Actor, ActorType, RecognitionRuntimeContext } from "../domain";
import { DuplicateActorError } from "../runtime/recognition-runtime-errors";

export type RegisterActorInput = {
  id?: string;
  trustDomainId: string;
  type: ActorType;
  displayName: string;
  roleIds?: string[];
  metadata?: Record<string, unknown>;
};

export type ActorRegistryService = {
  registerActor(input: RegisterActorInput): Actor;
  getActor(actorId: string): Actor | undefined;
  listActors(trustDomainId?: string): Actor[];
  suspendActor(actorId: string): Actor | undefined;
  reinstateActor(actorId: string): Actor | undefined;
  revokeActor(actorId: string): Actor | undefined;
  isRecognized(actorId: string, trustDomainId: string): boolean;
};

export function createActorRegistryService(context: RecognitionRuntimeContext): ActorRegistryService {
  const actors = new Map<string, Actor>();

  const setStatus = (actorId: string, status: Actor["status"]): Actor | undefined => {
    const actor = actors.get(actorId);
    if (!actor) return undefined;
    const updated: Actor = { ...actor, status };
    actors.set(actorId, updated);
    return updated;
  };

  return {
    registerActor(input) {
      const id = input.id ?? context.ids.nextId("actor");
      if (actors.has(id)) throw new DuplicateActorError(id);

      const actor: Actor = {
        id,
        trustDomainId: input.trustDomainId,
        type: input.type,
        displayName: input.displayName,
        status: "active",
        roleIds: input.roleIds,
        createdAt: context.clock.now(),
        metadata: input.metadata,
      };
      actors.set(id, actor);
      return actor;
    },

    getActor(actorId) {
      return actors.get(actorId);
    },

    listActors(trustDomainId) {
      const all = [...actors.values()];
      return trustDomainId ? all.filter((actor) => actor.trustDomainId === trustDomainId) : all;
    },

    suspendActor(actorId) {
      return setStatus(actorId, "suspended");
    },

    reinstateActor(actorId) {
      return setStatus(actorId, "active");
    },

    revokeActor(actorId) {
      return setStatus(actorId, "revoked");
    },

    isRecognized(actorId, trustDomainId) {
      const actor = actors.get(actorId);
      return actor !== undefined && actor.trustDomainId === trustDomainId;
    },
  };
}
