import test from "node:test";
import assert from "node:assert/strict";

import { createTrustDomainService } from "../src/features/recognition-runtime/services/trust-domain-service";
import { createPassportService } from "../src/features/recognition-runtime/services/passport-service";
import { createDeterministicContext } from "../src/features/recognition-runtime/fixtures/deterministic-context";
import { DuplicateTrustDomainError, UnknownPassportError, UnknownTrustDomainError } from "../src/features/recognition-runtime/runtime/recognition-runtime-errors";

test("createTrustDomain assigns a deterministic id and active status", () => {
  const trustDomains = createTrustDomainService(createDeterministicContext());
  const td = trustDomains.createTrustDomain({ name: "Datasys Agent Republic" });
  assert.equal(td.id, "trust-domain-0001");
  assert.equal(td.status, "active");
});

test("createTrustDomain rejects duplicate ids", () => {
  const trustDomains = createTrustDomainService(createDeterministicContext());
  trustDomains.createTrustDomain({ id: "td-1", name: "A" });
  assert.throws(() => trustDomains.createTrustDomain({ id: "td-1", name: "B" }), DuplicateTrustDomainError);
});

test("requireTrustDomain throws for an unknown id", () => {
  const trustDomains = createTrustDomainService(createDeterministicContext());
  assert.throws(() => trustDomains.requireTrustDomain("nope"), UnknownTrustDomainError);
});

test("suspendTrustDomain flips status to suspended", () => {
  const trustDomains = createTrustDomainService(createDeterministicContext());
  trustDomains.createTrustDomain({ id: "td-1", name: "A" });
  assert.equal(trustDomains.suspendTrustDomain("td-1").status, "suspended");
});

test("issuePassport creates an active, unexpired passport by default", () => {
  const passports = createPassportService(createDeterministicContext());
  const passport = passports.issuePassport({ actorId: "actor-1", trustDomainId: "td-1" });
  assert.equal(passport.status, "active");
  assert.equal(passport.actorId, "actor-1");
});

test("requirePassport throws for an unknown id", () => {
  const passports = createPassportService(createDeterministicContext());
  assert.throws(() => passports.requirePassport("nope"), UnknownPassportError);
});

test("listPassportsForActor filters correctly", () => {
  const passports = createPassportService(createDeterministicContext());
  passports.issuePassport({ id: "p1", actorId: "a1", trustDomainId: "td-1" });
  passports.issuePassport({ id: "p2", actorId: "a2", trustDomainId: "td-1" });
  assert.deepEqual(
    passports.listPassportsForActor("a1").map((p) => p.id),
    ["p1"]
  );
});

test("revokePassport sets status revoked and stamps revokedAt", () => {
  const passports = createPassportService(createDeterministicContext());
  passports.issuePassport({ id: "p1", actorId: "a1", trustDomainId: "td-1" });
  const revoked = passports.revokePassport("p1");
  assert.equal(revoked.status, "revoked");
  assert.ok(revoked.revokedAt);
});

test("isPassportActive is false once expired", () => {
  const passports = createPassportService(createDeterministicContext());
  const passport = passports.issuePassport({
    id: "p1",
    actorId: "a1",
    trustDomainId: "td-1",
    expiresAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(passports.isPassportActive(passport, "2025-12-31T00:00:00.000Z"), true);
  assert.equal(passports.isPassportActive(passport, "2026-01-01T00:00:00.000Z"), false);
  assert.equal(passports.isPassportActive(passport, "2026-06-01T00:00:00.000Z"), false);
});

test("isPassportActive is false once suspended or revoked", () => {
  const passports = createPassportService(createDeterministicContext());
  passports.issuePassport({ id: "p1", actorId: "a1", trustDomainId: "td-1" });
  const suspended = passports.suspendPassport("p1");
  assert.equal(passports.isPassportActive(suspended, "2025-01-01T00:00:00.000Z"), false);
});
