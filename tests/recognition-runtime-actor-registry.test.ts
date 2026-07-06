import test from "node:test";
import assert from "node:assert/strict";

import { createActorRegistryService } from "../src/features/recognition-runtime/services/actor-registry-service";
import { createDeterministicContext } from "../src/features/recognition-runtime/fixtures/deterministic-context";
import { DuplicateActorError } from "../src/features/recognition-runtime/runtime/recognition-runtime-errors";

const makeRegistry = () => createActorRegistryService(createDeterministicContext());

test("registerActor stores an active actor with a deterministic id when none is given", () => {
  const registry = makeRegistry();
  const actor = registry.registerActor({ trustDomainId: "td-1", type: "human", displayName: "Victor Valverde" });
  assert.equal(actor.id, "actor-0001");
  assert.equal(actor.status, "active");
  assert.equal(actor.trustDomainId, "td-1");
});

test("registerActor rejects a duplicate id", () => {
  const registry = makeRegistry();
  registry.registerActor({ id: "actor-victor", trustDomainId: "td-1", type: "human", displayName: "Victor" });
  assert.throws(
    () => registry.registerActor({ id: "actor-victor", trustDomainId: "td-1", type: "human", displayName: "Victor" }),
    DuplicateActorError
  );
});

test("getActor returns undefined for an unregistered id", () => {
  const registry = makeRegistry();
  assert.equal(registry.getActor("nope"), undefined);
});

test("listActors filters by trust domain", () => {
  const registry = makeRegistry();
  registry.registerActor({ id: "a1", trustDomainId: "td-1", type: "human", displayName: "A1" });
  registry.registerActor({ id: "a2", trustDomainId: "td-2", type: "human", displayName: "A2" });
  assert.deepEqual(
    registry.listActors("td-1").map((a) => a.id),
    ["a1"]
  );
  assert.equal(registry.listActors().length, 2);
});

test("suspendActor and reinstateActor toggle status", () => {
  const registry = makeRegistry();
  registry.registerActor({ id: "a1", trustDomainId: "td-1", type: "human", displayName: "A1" });
  assert.equal(registry.suspendActor("a1")?.status, "suspended");
  assert.equal(registry.reinstateActor("a1")?.status, "active");
});

test("revokeActor sets status to revoked", () => {
  const registry = makeRegistry();
  registry.registerActor({ id: "a1", trustDomainId: "td-1", type: "human", displayName: "A1" });
  assert.equal(registry.revokeActor("a1")?.status, "revoked");
});

test("isRecognized is true only for actors registered in the given trust domain", () => {
  const registry = makeRegistry();
  registry.registerActor({ id: "a1", trustDomainId: "td-1", type: "human", displayName: "A1" });
  assert.equal(registry.isRecognized("a1", "td-1"), true);
  assert.equal(registry.isRecognized("a1", "td-2"), false);
  assert.equal(registry.isRecognized("unknown", "td-1"), false);
});
