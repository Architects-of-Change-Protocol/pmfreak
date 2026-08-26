/**
 * P0-LAUNCH-02 — integrated Founder launch acceptance.
 *
 * PMFreak already proves the pieces of this story, but in separate places and at
 * separate layers: `tests/frontera-enforcement-boundary.test.ts` proves ALLOW,
 * DENY, cross-organization isolation, durability and revocation against the real
 * packaged runtime; `tests/e2e/p2-14-founder-story.spec.ts` proves the
 * authenticated Founder browser journey; `npm run check:packaged-aoc-artifacts`
 * proves the installed tree matches `vendor/aoc-consumer.lock.json`.
 *
 * What no single command proved is that the SAME PROCESS performing the governed
 * decisions is the one resolving the pinned artifacts. "The launch stack is
 * converged" was therefore an inference across three commands rather than one
 * claim. This file makes that claim once, in one process.
 *
 * Nothing here stubs a decision. Every ALLOW and DENY is produced by the genuine
 * `AocKernel` reading a genuine durable `KernelAuthorityStore`, through the real
 * product enforcement path (`authorizeFronteraDispatch`). The store is a
 * throwaway SQLite file under the OS temp directory — file-backed on purpose,
 * because an in-memory store cannot prove durability across a restart.
 *
 * It deliberately does NOT re-prove what the browser journey owns — Founder
 * authentication and tenant binding (matrix items A and B) need a real session
 * and are asserted by `npm run test:e2e:p2-14`. This covers C through J.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  openOperatorStore,
  provisionPmfreakDispatchAuthority,
  revokePmfreakDispatchAuthority,
} from "../scripts/frontera-authority-provisioning.mjs";
import { authorizeFronteraDispatch } from "@/lib/integrations/frontera/enforcement-adapter";

const ROOT = process.cwd();
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

const lock = readJson(path.join(ROOT, "vendor/aoc-consumer.lock.json"));
const PROTOCOL = "@aoc/protocol";
const RUNTIME = "@aoc-enterprise/runtime";
const installedManifest = (name: string) =>
  readJson(path.join(ROOT, "node_modules", name, "package.json"));

const ORG_A = "workspace-launch02-a";
const ORG_B = "workspace-launch02-b";
const PROJ_A = "project-launch02-a";
const PROJ_B = "project-launch02-b";
const FOUNDER = "founder-launch02";
const ACTION = "action-launch02";

const request = (over: Partial<{ workspaceId: string; projectId: string; principalUserId: string }> = {}) => ({
  workspaceId: over.workspaceId ?? ORG_A,
  projectId: over.projectId ?? PROJ_A,
  principalUserId: over.principalUserId ?? FOUNDER,
  actionId: ACTION,
});
const withStore = (store: unknown) => ({ openAuthorityStore: async () => store as never });

/** A file-backed store path, so durability is a real property and not a fiction. */
const storePath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "p0-launch-02-")),
  "kernel-authority.sqlite",
);

/** Provisions once into the durable store, and returns what the operator bound. */
async function provisionOnce() {
  const store = await openOperatorStore(storePath);
  try {
    return await provisionPmfreakDispatchAuthority(store, {
      organizationId: ORG_A,
      principalUserId: FOUNDER,
      projectId: PROJ_A,
      operatorActorId: "operator-p0-launch-02",
    });
  } finally {
    await store.close();
  }
}

async function decide(over: Parameters<typeof request>[0] = {}) {
  const store = await openOperatorStore(storePath);
  try {
    return await authorizeFronteraDispatch(request(over), withStore(store));
  } finally {
    await store.close();
  }
}

// ---------------------------------------------------------------------------
// J — PACKAGE IDENTITY, resolved by THIS process
// ---------------------------------------------------------------------------

test("J: this process resolves the pinned Protocol candidate, not the burned one", () => {
  const installed = installedManifest(PROTOCOL);
  assert.equal(installed.name, PROTOCOL);
  assert.equal(installed.version, lock.artifacts[PROTOCOL].version);
  // Equality against the lock alone would still pass if the lock itself
  // regressed, so the burned identity is excluded by name as well.
  assert.notEqual(installed.version, "0.2.0-rc.0", "the burned rc.0 candidate must never be resolved");
});

test("J: this process resolves the pinned Frontera runtime", () => {
  const installed = installedManifest(RUNTIME);
  assert.equal(installed.name, RUNTIME);
  assert.equal(installed.version, lock.artifacts[RUNTIME].version);
});

test("J: the vendored tarballs hash to the identities the consumer lock records", () => {
  for (const name of [PROTOCOL, RUNTIME]) {
    const entry = lock.artifacts[name];
    const actual = createHash("sha256").update(fs.readFileSync(path.join(ROOT, entry.tarball))).digest("hex");
    assert.equal(actual, entry.sha256, `${name}: ${entry.tarball}`);
  }
});

test("J: the installed integration contract agrees with the consumer lock", () => {
  const shipped = readJson(path.join(ROOT, "node_modules", PROTOCOL, "integration-contract.json"));
  assert.equal(shipped.contract, lock.contract);
  assert.equal(shipped.contractVersion, lock.contractVersion);
});

test("J: no local source fallback — both artifacts resolve from node_modules", () => {
  for (const name of [PROTOCOL, RUNTIME]) {
    const resolved = requireFromRoot.resolve(name);
    const expectedRoot = path.join(ROOT, "node_modules", name) + path.sep;
    assert.ok(resolved.startsWith(expectedRoot), `${name} resolved to ${resolved}, outside ${expectedRoot}`);
  }
  for (const forbidden of ["src/aoc/protocol", "src/aoc/enterprise"]) {
    assert.equal(fs.existsSync(path.join(ROOT, forbidden)), false, `${forbidden} must not be reintroduced`);
  }
});

test("J: no private Frontera implementation package is a direct PMFreak dependency", () => {
  const manifest = readJson(path.join(ROOT, "package.json"));
  const declared = { ...manifest.dependencies, ...manifest.devDependencies };
  const privatePackages: string[] = lock.privateFronteraWorkspaces?.packages ?? [];
  assert.ok(privatePackages.length > 0, "the lock must name the private packages this guards");
  for (const name of privatePackages) {
    assert.equal(name in declared, false, `${name} must not be a direct dependency`);
  }
});

// ---------------------------------------------------------------------------
// C..I — the governed journey, through the real product enforcement path
// ---------------------------------------------------------------------------

test("C: an operator provisions minimum authority through the packaged surface", async () => {
  const provisioned = await provisionOnce();
  assert.ok(provisioned.actorId, "a Frontera actor was bound");
  assert.ok(provisioned.trustDomainId, "a trust domain was bound");
  // The binding must be explicit, not an identity pun on the PMFreak user id.
  assert.notEqual(provisioned.actorId, FOUNDER, "the Frontera actor id must not be the PMFreak user id");
});

test("D: the provisioned Founder is ALLOWed for the governed action", async () => {
  const decision = await decide();
  assert.equal(decision.allowed, true, `expected ALLOW, got ${JSON.stringify(decision)}`);
  assert.ok(decision.allowed && decision.decisionId, "a real decision id is produced");
  assert.ok(decision.allowed && decision.fronteraActorId, "the decision names the bound Frontera actor");
});

test("E: a project scope the operator never granted is DENYed", async () => {
  const decision = await decide({ projectId: PROJ_B });
  assert.equal(decision.allowed, false, "an ungranted scope must be denied");
  assert.ok(!decision.allowed && decision.failureClass, "the denial is classified");
});

test("F: tenant B cannot consume tenant A authority", async () => {
  const decision = await decide({ workspaceId: ORG_B });
  assert.equal(decision.allowed, false, "organization A authority must not carry into organization B");
});

test("H: the ALLOW is correlated, and a denial leaks no authority detail", async () => {
  const allowed = await decide();
  assert.ok(allowed.allowed && allowed.decisionId, "the ALLOW carries a correlatable decision id");

  const denied = await decide({ principalUserId: "not-a-principal" });
  assert.equal(denied.allowed, false);
  const serialized = JSON.stringify(denied);
  assert.equal(/trustDomainId/.test(serialized), false, "a denial must not disclose the trust domain");
  assert.equal(/fronteraActorId/.test(serialized), false, "a denial must not disclose the bound actor");
});

test("I: authority survives closing and reopening the durable store", async () => {
  // Every decision above already reopened the file-backed store, but this
  // asserts the property by name so a future move to an in-memory store cannot
  // quietly delete durability coverage.
  assert.equal(fs.existsSync(storePath), true, "the authority store must be file-backed to prove durability");
  const decision = await decide();
  assert.equal(decision.allowed, true, "a restart must not silently lose provisioned authority");
});

test("G: the operator revokes, and the formerly allowed action is then DENYed", async () => {
  const before = await decide();
  assert.equal(before.allowed, true, "the action must be allowed before revocation, or the test proves nothing");

  const revoking = await openOperatorStore(storePath);
  try {
    await revokePmfreakDispatchAuthority(revoking, {
      organizationId: ORG_A,
      principalUserId: FOUNDER,
      projectId: PROJ_A,
      operatorActorId: "operator-p0-launch-02",
      reason: "P0-LAUNCH-02 acceptance",
    });
  } finally {
    await revoking.close();
  }

  const after = await decide();
  assert.equal(after.allowed, false, "revocation must deny the exact action that was previously allowed");
});
