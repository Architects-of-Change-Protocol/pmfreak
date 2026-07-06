import test from "node:test";
import assert from "node:assert/strict";

import { createCapabilityTokenService } from "../src/features/recognition-runtime/services/capability-token-service";
import { createDeterministicContext } from "../src/features/recognition-runtime/fixtures/deterministic-context";
import { UnknownCapabilityTokenError } from "../src/features/recognition-runtime/runtime/recognition-runtime-errors";
import { matchesPattern } from "../src/features/recognition-runtime/services/pattern-matching";

test("issueCapabilityToken creates an active token", () => {
  const tokens = createCapabilityTokenService(createDeterministicContext());
  const token = tokens.issueCapabilityToken({
    actorId: "actor-victor",
    trustDomainId: "td-1",
    passportId: "passport-victor",
    capability: "update_project_status",
    resourceScope: "project:HMP-14665",
  });
  assert.equal(token.status, "active");
  assert.equal(token.capability, "update_project_status");
});

test("requireCapabilityToken throws for an unknown id", () => {
  const tokens = createCapabilityTokenService(createDeterministicContext());
  assert.throws(() => tokens.requireCapabilityToken("nope"), UnknownCapabilityTokenError);
});

test("listTokensForActor filters correctly", () => {
  const tokens = createCapabilityTokenService(createDeterministicContext());
  tokens.issueCapabilityToken({ id: "t1", actorId: "a1", trustDomainId: "td-1", passportId: "p1", capability: "c", resourceScope: "s" });
  tokens.issueCapabilityToken({ id: "t2", actorId: "a2", trustDomainId: "td-1", passportId: "p2", capability: "c", resourceScope: "s" });
  assert.deepEqual(
    tokens.listTokensForActor("a1").map((t) => t.id),
    ["t1"]
  );
});

test("revokeCapabilityToken marks the token revoked", () => {
  const tokens = createCapabilityTokenService(createDeterministicContext());
  tokens.issueCapabilityToken({ id: "t1", actorId: "a1", trustDomainId: "td-1", passportId: "p1", capability: "c", resourceScope: "s" });
  const revoked = tokens.revokeCapabilityToken("t1");
  assert.equal(revoked.status, "revoked");
  assert.ok(revoked.revokedAt);
});

test("isCapabilityTokenActive is false once expired or revoked", () => {
  const tokens = createCapabilityTokenService(createDeterministicContext());
  const token = tokens.issueCapabilityToken({
    id: "t1",
    actorId: "a1",
    trustDomainId: "td-1",
    passportId: "p1",
    capability: "c",
    resourceScope: "s",
    expiresAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(tokens.isCapabilityTokenActive(token, "2025-12-31T00:00:00.000Z"), true);
  assert.equal(tokens.isCapabilityTokenActive(token, "2026-01-01T00:00:00.000Z"), false);

  const revoked = tokens.revokeCapabilityToken("t1");
  assert.equal(tokens.isCapabilityTokenActive(revoked, "2025-01-01T00:00:00.000Z"), false);
});

test("matchesPattern supports exact and trailing-wildcard prefixes", () => {
  assert.equal(matchesPattern("project:HMP-14665", "project:HMP-14665"), true);
  assert.equal(matchesPattern("project:HMP-14665", "project:GCH-15992"), false);
  assert.equal(matchesPattern("project:*", "project:GCH-15992"), true);
  assert.equal(matchesPattern("finance:*", "project:HMP-14665"), false);
  assert.equal(matchesPattern("*", "anything"), true);
});
