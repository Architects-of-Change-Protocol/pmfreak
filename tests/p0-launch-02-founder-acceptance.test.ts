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
 * decisions is the one running the bytes of the verified artifacts. This file
 * makes that claim once, in one process.
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
 *
 * ---------------------------------------------------------------------------
 * Review hardening (PR #588). Seven findings, each reproduced before it was
 * fixed, and each about how this gate could pass VACUOUSLY:
 *
 *  1. Identity was compared only against the mutable consumer lock, so pins and
 *     lock moving together would be accepted. The baseline is now an immutable
 *     literal below, and the lock is checked AGAINST it rather than trusted as
 *     the source of truth.
 *  2. Hashing the tarball and separately resolving `node_modules` never proved
 *     the installed tree CAME FROM those bytes. The installed content is now
 *     fingerprinted against an extraction of the verified tarball.
 *  3. The private-package guard read only `dependencies` and `devDependencies`,
 *     so `optionalDependencies` was an open path around it. Every declaration
 *     section is guarded now.
 *  4. "H covered" rested on a non-empty decision id — synchronous correlation,
 *     not evidence. The durable authority audit trail is now actually read back.
 *  5. Redaction was asserted on an UNBOUND principal, which returns before the
 *     adapter ever loads the actor or trust domain, so the absence assertions
 *     were vacuous. Redaction is now asserted on the bound Founder's policy
 *     denial, against the known provisioned identifier VALUES.
 *  6. Every negative case accepted any `allowed === false`, so an outage
 *     (`frontera_unavailable`) satisfied them. Each denial now asserts its exact
 *     failure class and reason codes, and an induced outage is proven NOT to
 *     satisfy acceptance.
 *  7. "Minimum authority" checked only that ids came back. The persisted grant
 *     and capability token are now read from the store and their effective
 *     capability set asserted exactly.
 * ---------------------------------------------------------------------------
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
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
import type {
  KernelAuthorityEvent,
  KernelAuthorityRecord,
  KernelAuthorityStore,
} from "@aoc-enterprise/runtime/enterprise";
import {
  authorizeFronteraDispatch,
  type FronteraDispatchAuthorization,
} from "@/lib/integrations/frontera/enforcement-adapter";

/** The two branches of the product's own decision union, narrowed with a reason. */
type FronteraAllow = Extract<FronteraDispatchAuthorization, { allowed: true }>;
type FronteraDenial = Extract<FronteraDispatchAuthorization, { allowed: false }>;
const asAllow = (decision: FronteraDispatchAuthorization, why: string): FronteraAllow => {
  assert.equal(decision.allowed, true, `${why} — got ${JSON.stringify(decision)}`);
  return decision as FronteraAllow;
};
const asDenial = (decision: FronteraDispatchAuthorization, why: string): FronteraDenial => {
  assert.equal(decision.allowed, false, `${why} — got ${JSON.stringify(decision)}`);
  return decision as FronteraDenial;
};
/** Grant/token payload fields this acceptance asserts on. */
const stringsOf = (value: unknown): string[] => (value as readonly string[]).map(String).sort();

const ROOT = process.cwd();
const requireFromRoot = createRequire(path.join(ROOT, "package.json"));
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));

/**
 * THE IMMUTABLE LAUNCH BASELINE.
 *
 * Owned by this increment and deliberately NOT derived from
 * `vendor/aoc-consumer.lock.json`. The lock is mutable: a coordinated repin
 * would move the lock and the installed tree together, and an acceptance that
 * only compared those two to each other would stay green while the launch
 * baseline silently changed. Everything below is checked against these literals,
 * and the lock is checked against them too.
 *
 * Moving the launch baseline is a deliberate act that must edit this block.
 */
const LAUNCH_BASELINE = {
  "@aoc/protocol": {
    version: "0.2.0-rc.1",
    sha256: "b0d6ee6ff2010c4addab0bd683e2a89b9b2246f430c7e892fdc3d4123f3a3f60",
    integrity: "sha512-iJqgwo9ZLewWhY4HWOX1owfplgOzcjk2CuPOcI7ne8ZhwM8dekDaztaBhkfgos0IQ9mSH6fmefNA2yix8DO2bA==",
    tarball: "vendor/aoc-protocol-0.2.0-rc.1.tgz",
  },
  "@aoc-enterprise/runtime": {
    version: "1.2.1",
    sha256: "6b11e68e71b73e8a599c25c3b1ba26129de201b567664accf9874e06366e0628",
    integrity: "sha512-k3YmQ/GX6cHLLGjNzzYKHSIUT19U342jJF76l+qIbr2TKZTJJhvIQSjLIRuwfbeLZS1EqKOUNDrgPzdu0s5K3A==",
    tarball: "vendor/aoc-enterprise-runtime-1.2.1.tgz",
  },
  contract: "aoc.cross-repository-integration",
  contractVersion: "1.0.1",
} as const;

const PROTOCOL = "@aoc/protocol";
const RUNTIME = "@aoc-enterprise/runtime";
const PACKAGES = [PROTOCOL, RUNTIME] as const;

const lock = readJson(path.join(ROOT, "vendor/aoc-consumer.lock.json"));
const manifest = readJson(path.join(ROOT, "package.json"));
const packageLock = readJson(path.join(ROOT, "package-lock.json"));
const installedManifest = (name: string) => readJson(path.join(ROOT, "node_modules", name, "package.json"));
const sha256File = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
/** npm's Subresource Integrity form, computed from the artifact's own bytes. */
const sriOf = (file: string) => `sha512-${createHash("sha512").update(fs.readFileSync(file)).digest("base64")}`;

const ORG_A = "workspace-launch02-a";
const ORG_B = "workspace-launch02-b";
const PROJ_A = "project-launch02-a";
const PROJ_B = "project-launch02-b";
const FOUNDER = "founder-launch02";
const ACTION = "action-launch02";

/** The one action and one scope the operator is supposed to grant. Nothing else. */
const EXPECTED_ACTIONS = ["execute.material-action"];
const EXPECTED_SCOPES = [`project:${PROJ_A}`];
const EXPECTED_CAPABILITY = "material-action.dispatch";

const GRANT_ID = `grant-${ORG_A}-${FOUNDER}-${PROJ_A}`;
const TOKEN_ID = `cap-${ORG_A}-${FOUNDER}-${PROJ_A}`;

const request = (over: Partial<{ workspaceId: string; projectId: string; principalUserId: string }> = {}) => ({
  workspaceId: over.workspaceId ?? ORG_A,
  projectId: over.projectId ?? PROJ_A,
  principalUserId: over.principalUserId ?? FOUNDER,
  actionId: ACTION,
});
const withStore = (store: unknown) => ({ openAuthorityStore: async () => store as never });

/** File-backed, so durability is a real property and not a fiction. */
const storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "p0-launch-02-")), "kernel-authority.sqlite");

/** Read-only, organization-scoped context. `system: false` cannot reach a write path. */
const readContext = { system: false as const, organizationId: ORG_A };

let provisioned: { actorId: string; trustDomainId: string };

async function withOpenStore<T>(fn: (store: KernelAuthorityStore) => Promise<T>): Promise<T> {
  const store = await openOperatorStore(storePath);
  try { return await fn(store); } finally { await store.close(); }
}

const decide = (over: Parameters<typeof request>[0] = {}) =>
  withOpenStore((store) => authorizeFronteraDispatch(request(over), withStore(store)));

// ---------------------------------------------------------------------------
// J — the immutable launch baseline, bound to the bytes this process runs
// ---------------------------------------------------------------------------

test("J: the consumer lock agrees with the immutable launch baseline", () => {
  for (const name of PACKAGES) {
    const expected = LAUNCH_BASELINE[name];
    const entry = lock.artifacts[name];
    assert.equal(entry.version, expected.version, `${name}: lock version`);
    assert.equal(entry.sha256, expected.sha256, `${name}: lock sha256`);
    assert.equal(entry.tarball, expected.tarball, `${name}: lock tarball path`);
  }
  assert.equal(lock.contract, LAUNCH_BASELINE.contract);
  assert.equal(lock.contractVersion, LAUNCH_BASELINE.contractVersion);
});

test("J: package.json and package-lock.json target exactly the baseline artifacts", () => {
  for (const name of PACKAGES) {
    const expected = LAUNCH_BASELINE[name];
    const spec = `file:${expected.tarball}`;
    assert.equal(manifest.dependencies[name], spec, `${name}: package.json dependency spec`);
    assert.equal(packageLock.packages[""].dependencies[name], spec, `${name}: package-lock root spec`);

    const record = packageLock.packages[`node_modules/${name}`];
    assert.ok(record, `${name}: package-lock has no installed record`);
    assert.equal(record.version, expected.version, `${name}: package-lock version`);
    assert.equal(record.resolved, `file:${expected.tarball}`, `${name}: package-lock resolved target`);
    // Comparing the two locks to each other proves nothing: changed together
    // they still agree, while `npm ci` rejects the install with EINTEGRITY.
    // The SRI is therefore DERIVED from the verified tarball bytes and both
    // records are checked against it, and against the immutable baseline.
    const derivedIntegrity = sriOf(path.join(ROOT, expected.tarball));
    assert.equal(derivedIntegrity, expected.integrity, `${name}: tarball SRI must equal the launch baseline`);
    assert.equal(record.integrity, derivedIntegrity, `${name}: package-lock integrity must match the tarball bytes`);
    assert.equal(
      lock.artifacts[name].npmIntegrity,
      derivedIntegrity,
      `${name}: consumer lock npmIntegrity must match the tarball bytes`,
    );
  }
});

test("J: the vendored tarballs hash to the immutable baseline SHA-256", () => {
  for (const name of PACKAGES) {
    const expected = LAUNCH_BASELINE[name];
    assert.equal(sha256File(path.join(ROOT, expected.tarball)), expected.sha256, `${name}: ${expected.tarball}`);
  }
});

test("J: the installed packages are the baseline identities", () => {
  for (const name of PACKAGES) {
    const installed = installedManifest(name);
    assert.equal(installed.name, name);
    assert.equal(installed.version, LAUNCH_BASELINE[name].version, `${name}: installed version`);
  }
});

test("J: the installed trees are derived from the verified tarball bytes", () => {
  // Findings 1 and 2 together: matching name and version proves nothing about
  // provenance, because a same-name/same-version package installed from
  // different bytes satisfies both. This fingerprints the actual content.
  for (const name of PACKAGES) {
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "p0-launch-02-extract-"));
    try {
      execFileSync("tar", ["xzf", path.join(ROOT, LAUNCH_BASELINE[name].tarball), "-C", extractDir]);
      const fromTarball = path.join(extractDir, "package");
      const installedRoot = path.join(ROOT, "node_modules", name);

      const fingerprint = (root: string) => {
        const entries: string[] = [];
        const walk = (dir: string) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            // npm writes these into an installed package; they are not package content.
            if (entry.name === ".package-lock.json" || entry.name === ".bin") continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile()) entries.push(`${path.relative(root, full).split(path.sep).join("/")}:${sha256File(full)}`);
          }
        };
        walk(root);
        return { digest: createHash("sha256").update(entries.join("\n")).digest("hex"), count: entries.length };
      };

      const packed = fingerprint(fromTarball);
      const live = fingerprint(installedRoot);
      assert.ok(packed.count > 0, `${name}: the tarball extracted no files`);
      assert.equal(
        live.digest,
        packed.digest,
        `${name}: installed tree (${live.count} files) does not match the verified tarball (${packed.count} files)`,
      );
    } finally {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
  }
});

test("J: the installed integration contract is the baseline contract", () => {
  const shipped = readJson(path.join(ROOT, "node_modules", PROTOCOL, "integration-contract.json"));
  assert.equal(shipped.contract, LAUNCH_BASELINE.contract);
  assert.equal(shipped.contractVersion, LAUNCH_BASELINE.contractVersion);
});

test("J: no local source fallback — both artifacts resolve from node_modules", () => {
  for (const name of PACKAGES) {
    const resolved = requireFromRoot.resolve(name);
    const expectedRoot = path.join(ROOT, "node_modules", name) + path.sep;
    assert.ok(resolved.startsWith(expectedRoot), `${name} resolved to ${resolved}, outside ${expectedRoot}`);
  }
  for (const forbidden of ["src/aoc/protocol", "src/aoc/enterprise"]) {
    assert.equal(fs.existsSync(path.join(ROOT, forbidden)), false, `${forbidden} must not be reintroduced`);
  }
});

test("J: no private Frontera package is declared in ANY dependency section", () => {
  // The integration contract's obligation is that PMFreak must not "install,
  // declare or depend on" a private implementation module. "declare" covers
  // every section npm reads, so peerDependencies and optionalDependencies are
  // guarded alongside the two that were originally checked.
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
  const declared = new Map<string, string>();
  for (const section of sections) {
    for (const name of Object.keys(manifest[section] ?? {})) declared.set(name, section);
  }
  const privatePackages: string[] = lock.privateFronteraWorkspaces?.packages ?? [];
  assert.ok(privatePackages.length > 0, "the lock must name the private packages this guards");
  for (const name of privatePackages) {
    assert.equal(declared.has(name), false, `${name} must not be declared (found in ${declared.get(name)})`);
  }
});

// ---------------------------------------------------------------------------
// C..I — the governed journey, through the real product enforcement path
// ---------------------------------------------------------------------------

test("C: an operator provisions authority through the packaged surface", async () => {
  provisioned = await withOpenStore((store) =>
    provisionPmfreakDispatchAuthority(store, {
      organizationId: ORG_A,
      principalUserId: FOUNDER,
      projectId: PROJ_A,
      operatorActorId: "operator-p0-launch-02",
    }),
  );
  assert.ok(provisioned.actorId, "a Frontera actor was bound");
  assert.ok(provisioned.trustDomainId, "a trust domain was bound");
  // The binding must be explicit, not an identity pun on the PMFreak user id.
  assert.notEqual(provisioned.actorId, FOUNDER, "the Frontera actor id must not be the PMFreak user id");
});

test("C: the PERSISTED authority is exactly the intended minimum", async () => {
  // Behavioural assertions cannot see over-provisioning: the adapter only ever
  // asks for one action, so a grant broadened to ten would still answer the
  // same way. This reads what was actually written.
  const records: readonly KernelAuthorityRecord[] = await withOpenStore((store) =>
    store.listRecords(readContext, { organizationId: ORG_A }),
  );
  const byId = new Map(records.map((record) => [record.entityId, record]));

  for (const [entityId, kind] of [[GRANT_ID, "authority-grant"], [TOKEN_ID, "capability-token"]] as const) {
    const record = byId.get(entityId);
    assert.ok(record, `${kind} ${entityId} was not persisted`);
    assert.equal(record.entityKind, kind);
    assert.equal(record.status, "active");
    assert.equal(record.organizationId, ORG_A);
    assert.equal(record.payload.capability, EXPECTED_CAPABILITY, `${kind}: capability`);
    // Exact set equality — a superset is precisely the defect being guarded.
    assert.deepEqual(stringsOf(record.payload.actions), EXPECTED_ACTIONS, `${kind}: actions must be exactly the minimum`);
    assert.deepEqual(stringsOf(record.payload.resourceScopes), EXPECTED_SCOPES, `${kind}: scopes must be exactly the minimum`);
    assert.equal(record.payload.subjectActorId, provisioned.actorId, `${kind}: subject actor`);
    assert.equal(record.payload.trustDomainId, provisioned.trustDomainId, `${kind}: trust domain`);
    for (const scope of stringsOf(record.payload.resourceScopes)) {
      assert.equal(scope.includes("*"), false, `${kind}: no wildcard scope`);
      assert.equal(scope.includes(PROJ_B), false, `${kind}: must not reach ${PROJ_B}`);
    }
  }

  // No OTHER grant or token may exist for this organization.
  const authorityRecords = records.filter(
    (record) => record.entityKind === "authority-grant" || record.entityKind === "capability-token",
  );
  assert.deepEqual(
    authorityRecords.map((record) => record.entityId).sort(),
    [TOKEN_ID, GRANT_ID].sort(),
    "the effective capability set must be exactly one grant and one token",
  );
});

test("D: the provisioned Founder is ALLOWed, with the exact expected reason", async () => {
  const decision = asAllow(await decide(), "the provisioned Founder must be allowed");
  assert.deepEqual([...decision.reasonCodes], ["ACTION_ALLOWED"], "the ALLOW must be an authorization, not a fallback");
  assert.ok(decision.decisionId, "a real decision id is produced");
  assert.equal(decision.fronteraActorId, provisioned.actorId);
  assert.equal(decision.trustDomainId, provisioned.trustDomainId);
});

test("E: an ungranted project scope is a POLICY denial, not an outage", async () => {
  const decision = asDenial(await decide({ projectId: PROJ_B }), "an ungranted scope must be denied");
  // The exact class matters: `frontera_unavailable` is an outage and must never
  // satisfy an authorization acceptance criterion.
  assert.equal(decision.failureClass, "frontera_denied", "must be a policy denial from the kernel");
  assert.deepEqual(
    [...decision.reasonCodes].sort(),
    ["AUTHORITY_CAPABILITY_MISSING", "POLICY_ACTION_PROHIBITED"],
    "the denial must name the missing capability",
  );
  assert.ok(decision.decisionId, "a real evaluation produced this denial");
});

test("F: tenant B cannot consume tenant A authority, and is refused at the binding", async () => {
  const decision = asDenial(await decide({ workspaceId: ORG_B }), "tenant B must be refused");
  assert.equal(decision.failureClass, "frontera_actor_unbound", "organization B has no actor binding at all");
  assert.deepEqual([...decision.reasonCodes], ["FRONTERA_ACTOR_UNBOUND"]);
});

test("H: the durable audit trail records the provisioned authority and survives reopen", async () => {
  // A returned decision id is synchronous correlation, not evidence. This reads
  // the immutable authority audit trail back out of a REOPENED store.
  for (const [entityKind, entityId] of [["authority-grant", GRANT_ID], ["capability-token", TOKEN_ID]] as const) {
    const events: readonly KernelAuthorityEvent[] = await withOpenStore((store) =>
      store.listEvents(readContext, ORG_A, entityKind, entityId),
    );
    assert.ok(events.length >= 1, `${entityKind}: no audit events were retrievable`);
    const provisionedEvent = events.find((event) => event.eventType === "KernelAuthorityEntityProvisioned");
    assert.ok(provisionedEvent, `${entityKind}: no provisioning event in the audit trail`);
    assert.equal(provisionedEvent.organizationId, ORG_A, `${entityKind}: audit record names the tenant`);
    assert.equal(provisionedEvent.entityId, entityId, `${entityKind}: audit record names the entity`);
    assert.equal(provisionedEvent.provisionedBy, "operator-p0-launch-02", `${entityKind}: audit record credits the operator`);
    assert.ok(provisionedEvent.occurredAt, `${entityKind}: audit record is timestamped`);
    assert.equal(typeof provisionedEvent.sequence, "number", `${entityKind}: audit record is sequenced`);
    assert.deepEqual(
      stringsOf(provisionedEvent.payload.actions),
      EXPECTED_ACTIONS,
      `${entityKind}: the audit record describes the governed action`,
    );
    assert.deepEqual(
      stringsOf(provisionedEvent.payload.resourceScopes),
      EXPECTED_SCOPES,
      `${entityKind}: the audit record describes the governed scope`,
    );
  }
});

test("H: a policy denial leaks no authority detail — asserted on the BOUND actor's own values", async () => {
  // The unbound-principal path returns before the adapter has loaded the actor
  // or its trust domain, so asserting absence there proves nothing. This uses
  // the bound Founder's real denial, and asserts the KNOWN VALUES are absent
  // rather than merely that field names are.
  assert.ok(provisioned.actorId && provisioned.trustDomainId, "the bound identifiers must be known to assert their absence");

  const denied = asDenial(await decide({ projectId: PROJ_B }), "the bound Founder must be denied on PROJ_B");
  assert.equal(denied.failureClass, "frontera_denied", "this must be the post-resolution policy path");

  const serialized = JSON.stringify(denied);
  assert.equal(serialized.includes(provisioned.actorId), false, "the bound Frontera actor id must not leak");
  assert.equal(serialized.includes(provisioned.trustDomainId), false, "the bound trust domain id must not leak");
  assert.equal(/fronteraActorId|trustDomainId/.test(serialized), false, "no authority field may be present at all");
});

test("I: authority survives closing and reopening the durable store", async () => {
  assert.equal(fs.existsSync(storePath), true, "the authority store must be file-backed to prove durability");
  const decision = asAllow(await decide(), "a restart must not silently lose provisioned authority");
  assert.deepEqual([...decision.reasonCodes], ["ACTION_ALLOWED"]);
});

test("I: authority survives a FRESH PROCESS that only knows the store path", () => {
  // Closing and reopening inside one process cannot distinguish a durable store
  // from module-level state that merely created the configured file, and
  // `existsSync` only proves a path exists. This authorizes from a child process
  // that receives nothing but the path, so no in-memory state can cross.
  const childSource = `
import { openOperatorStore } from ${JSON.stringify(path.join(ROOT, "scripts/frontera-authority-provisioning.mjs"))};
import { authorizeFronteraDispatch } from "@/lib/integrations/frontera/enforcement-adapter";
const store = await openOperatorStore(process.env.STORE_PATH);
try {
  const decision = await authorizeFronteraDispatch(
    { workspaceId: ${JSON.stringify(ORG_A)}, projectId: ${JSON.stringify(PROJ_A)}, principalUserId: ${JSON.stringify(FOUNDER)}, actionId: ${JSON.stringify(ACTION)} },
    { openAuthorityStore: async () => store },
  );
  process.stdout.write("RESULT:" + JSON.stringify(decision));
} finally {
  await store.close();
}
`;
  const childFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "p0-launch-02-child-")), "restart-probe.mts");
  fs.writeFileSync(childFile, childSource);
  try {
    const stdout = execFileSync("npx", ["tsx", childFile], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, STORE_PATH: storePath },
    });
    const marker = stdout.lastIndexOf("RESULT:");
    assert.notEqual(marker, -1, `the child process produced no decision: ${stdout}`);
    const decision = JSON.parse(stdout.slice(marker + "RESULT:".length)) as FronteraDispatchAuthorization;
    const allowed = asAllow(decision, "a fresh process must still see the provisioned authority");
    assert.deepEqual([...allowed.reasonCodes], ["ACTION_ALLOWED"]);
    assert.equal(allowed.fronteraActorId, provisioned.actorId, "the fresh process resolved the same bound actor");
  } finally {
    fs.rmSync(path.dirname(childFile), { recursive: true, force: true });
  }
});

test("NEGATIVE CONTROL: an unavailable store is NOT accepted as a denial", async () => {
  // Finding 6 in one assertion: if acceptance treated any `allowed === false` as
  // a denial, an outage would satisfy E, F and G. It must be distinguishable.
  const outage = asDenial(
    await authorizeFronteraDispatch(request(), {
      openAuthorityStore: async () => { throw new Error("induced store outage"); },
    }),
    "an induced outage still returns a non-allow",
  );
  assert.equal(outage.failureClass, "frontera_unavailable", "an outage must classify as unavailable");
  assert.deepEqual([...outage.reasonCodes], ["FRONTERA_EVALUATION_UNAVAILABLE"]);
  // The point: this class is never what a policy denial looks like.
  assert.notEqual(outage.failureClass, "frontera_denied");
  assert.notEqual(outage.failureClass, "frontera_actor_unbound");
});

test("G: the operator revokes, and the same action becomes a REVOKED denial", async () => {
  asAllow(await decide(), "the action must be allowed before revocation, or this proves nothing");

  await withOpenStore((store) =>
    revokePmfreakDispatchAuthority(store, {
      organizationId: ORG_A,
      principalUserId: FOUNDER,
      projectId: PROJ_A,
      operatorActorId: "operator-p0-launch-02",
      reason: "P0-LAUNCH-02 acceptance",
    }),
  );

  const after = asDenial(await decide(), "revocation must deny the exact action that was previously allowed");
  assert.equal(after.failureClass, "frontera_denied", "the denial must come from evaluation, not from an outage");
  assert.deepEqual(
    [...after.reasonCodes].sort(),
    ["AUTHORITY_CAPABILITY_REVOKED", "POLICY_ACTION_PROHIBITED"],
    "the denial must name the revocation as its cause",
  );
});

test("H: the revocation itself is recorded in the durable audit trail", async () => {
  for (const [entityKind, entityId] of [["authority-grant", GRANT_ID], ["capability-token", TOKEN_ID]] as const) {
    const events: readonly KernelAuthorityEvent[] = await withOpenStore((store) =>
      store.listEvents(readContext, ORG_A, entityKind, entityId),
    );
    const revoked = events.find((event) => event.eventType === "KernelAuthorityEntityRevoked");
    assert.ok(revoked, `${entityKind}: the revocation is not observable in the audit trail`);
    assert.equal(revoked.provisionedBy, "operator-p0-launch-02", `${entityKind}: the revocation credits the operator`);
    // The trail is append-only: provisioning is still there after revocation.
    assert.ok(
      events.some((event) => event.eventType === "KernelAuthorityEntityProvisioned"),
      `${entityKind}: the audit trail must retain the original provisioning`,
    );
    assert.ok(revoked.sequence > 1, `${entityKind}: the revocation must follow the provisioning in sequence`);
  }
});
