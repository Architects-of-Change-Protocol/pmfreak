/**
 * Downstream contract test for the Frontera 1.2.0 review fixes PMFreak depends on.
 *
 * Frontera has its own suite for these; this is deliberately NOT a copy of it.
 * It asserts only the package behaviours PMFreak's enforcement boundary relies
 * on, so that a future artifact swap which silently regressed one of them would
 * fail here rather than in production.
 *
 * Every assertion runs against the REAL packaged @aoc-enterprise/runtime@1.2.0.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import {
  openOperatorStore,
  provisionPmfreakDispatchAuthority,
  revokePmfreakDispatchAuthority,
  projectScope,
  PMFREAK_EXTERNAL_SUBJECT_SYSTEM,
  FRONTERA_DISPATCH_ACTION,
} from "../scripts/frontera-authority-provisioning.mjs";
import { createDurableKernelProviders, createKernelAuthorityProvisioningService } from "@aoc-enterprise/runtime/enterprise";
import type { KernelAuthorityStore } from "@aoc-enterprise/runtime/enterprise";
import { createAocKernel } from "@aoc-enterprise/runtime/kernel";
import { authorizeFronteraDispatch } from "@/lib/integrations/frontera";


/**
 * `better-sqlite3` ships no type declarations and is reached here only to
 * corrupt a store on purpose. Rather than adding a dependency or letting an
 * implicit `any` through, this names the exact surface these tests use.
 */
type RawSqlite = {
  prepare(sql: string): {
    get(): { event_id: string; payload_json: string } | undefined;
    run(...params: unknown[]): { changes: number };
  };
  close(): void;
};
/**
 * Loaded through `createRequire` rather than `import`, because the package
 * carries no declarations and a bare import is an implicit-any error the
 * project's typecheck rejects. `@types/better-sqlite3` is not worth adding as a
 * dependency for two lines of deliberate corruption in one test.
 */
function openRawSqlite(dbPath: string): RawSqlite {
  const requireFromRepo = createRequire(path.join(process.cwd(), "package.json"));
  const Database = requireFromRepo("better-sqlite3") as new (file: string) => RawSqlite;
  return new Database(dbPath);
}

const ORG = "workspace-aaaa";
const USER = "user-aaaa";
const PROJ = "project-aaaa";

async function seeded(dbPath?: string) {
  const store = await openOperatorStore(dbPath);
  const provisioned = await provisionPmfreakDispatchAuthority(store, {
    organizationId: ORG,
    principalUserId: USER,
    projectId: PROJ,
  });
  return { store, provisioned };
}

async function resolveActor(store: KernelAuthorityStore) {
  return store.findActorByExternalSubject({ system: false, organizationId: ORG }, ORG, {
    system: PMFREAK_EXTERNAL_SUBJECT_SYSTEM,
    subjectId: USER,
  });
}

async function evaluate(store: KernelAuthorityStore, over: Record<string, unknown> = {}) {
  const actor = await resolveActor(store);
  assert.ok(actor, "actor must resolve");
  const service = await createDurableKernelProviders({ store, organizationId: ORG });
  const kernel = createAocKernel({
    recognitionProvider: service.recognitionProvider,
    clock: service.clock,
    idGenerator: service.idGenerator,
  });
  return kernel.evaluate({
    requestId: "req-contract",
    actor: { id: actor!.entityId, trustDomainId: actor!.trustDomainId! },
    action: { type: FRONTERA_DISPATCH_ACTION, resourceScope: projectScope(PROJ) },
    organization: { id: ORG },
    requestedAt: new Date().toISOString(),
    ...over,
  } as never);
}

/** C — §6/§9: the object the product receives carries no way to change the world. */
test("C: the decision service exposes no authority-mutation handle", async () => {
  const { store } = await seeded();
  const service = await createDurableKernelProviders({ store, organizationId: ORG });

  // 1.1.0 handed these mutable engines to consumers; 1.2.0 must not.
  for (const handle of ["recognitionRuntime", "authorityRuntime", "approvalRuntime", "handshakeRuntime"]) {
    assert.ok(!(handle in service), `decision service must not expose '${handle}'`);
  }
  // Nor any issuance method, at any depth of the returned object.
  for (const method of [
    "registerActor",
    "issuePassport",
    "issueCapabilityToken",
    "registerRootIssuer",
    "issueAuthorityGrant",
    "issueDelegationGrant",
    "createTrustDomain",
  ]) {
    for (const value of Object.values(service as unknown as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        assert.ok(!(method in (value as object)), `no reachable '${method}' on the decision surface`);
      }
    }
    assert.ok(!(method in (service as unknown as Record<string, unknown>)), `no '${method}' on the decision service`);
  }
  await store.close();
});

/** D/E — §7: organization must be stated with the typed field, and must match. */
test("D: an omitted organization is never an implicit match", async () => {
  const { store } = await seeded();
  const decision = await evaluate(store, { organization: undefined });
  assert.notEqual(decision.status, "allowed", "unstated organization must not be allowed");
  await store.close();
});

test("E: a wrong organization is denied", async () => {
  const { store } = await seeded();
  const decision = await evaluate(store, { organization: { id: "workspace-other" } });
  assert.notEqual(decision.status, "allowed");
  await store.close();
});

test("E2: free-form context.organizationId cannot substitute for the typed field", async () => {
  const { store } = await seeded();
  // Organization omitted, but smuggled through context — must still deny.
  const smuggled = await evaluate(store, { organization: undefined, context: { organizationId: ORG } });
  assert.notEqual(smuggled.status, "allowed", "context must not substitute for the typed organization");
  // And context must not override a wrong typed organization either.
  const override = await evaluate(store, { organization: { id: "workspace-other" }, context: { organizationId: ORG } });
  assert.notEqual(override.status, "allowed", "context must not rescue a wrong typed organization");
  await store.close();
});

test("F: a correctly stated organization is eligible", async () => {
  const { store } = await seeded();
  const decision = await evaluate(store);
  assert.equal(decision.status, "allowed");
  await store.close();
});

/** G — revocation denies with a reason that names it. */
test("G: revoked authority denies", async () => {
  const { store } = await seeded();
  await revokePmfreakDispatchAuthority(store, { organizationId: ORG, principalUserId: USER, projectId: PROJ });
  const decision = await evaluate(store);
  assert.notEqual(decision.status, "allowed");
  assert.ok(
    decision.reasonCodes.some((code: string) => /REVOKED/.test(code)),
    `expected a revocation reason, got ${JSON.stringify(decision.reasonCodes)}`,
  );
  await store.close();
});

/** H — an expired credential must not shadow a valid covering one. */
test("H: an expired credential does not shadow a valid covering credential", async () => {
  const { store, provisioned } = await seeded();
  const operator = createKernelAuthorityProvisioningService({ store, organizationId: ORG });
  await operator.provisionCapabilityToken(
    { system: true, actorId: "operator-contract-test" },
    {
      capabilityTokenId: "cap-expired",
      subjectActorId: provisioned.actorId,
      principalActorId: provisioned.actorId,
      issuerActorId: provisioned.orgActorId,
      trustDomainId: provisioned.trustDomainId,
      capability: "material-action.dispatch",
      actions: [FRONTERA_DISPATCH_ACTION],
      resourceScopes: [projectScope(PROJ)],
      riskLevel: "medium",
      expiresAt: "2020-01-01T00:00:00.000Z",
    },
  );
  const decision = await evaluate(store);
  assert.equal(decision.status, "allowed", "a live grant must still be honoured alongside an expired one");
  await store.close();
});

/**
 * A/B — persisted-integrity failures. These are the two defects that most
 * directly threaten PMFreak: a tampered payload could widen a scope, and a lost
 * revocation could resurrect withdrawn authority. Frontera raises on both; what
 * matters downstream is that PMFreak turns that into a denial and dispatches
 * nothing, which is asserted here through the real adapter.
 */
test("A/B: tampered payload and lost tail revocation both fail closed through the PMFreak adapter", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frontera-integrity-"));
  const dbPath = path.join(dir, "kernel-authority.sqlite");
  const openStore = (): Promise<KernelAuthorityStore> => openOperatorStore(dbPath);
  const request = { workspaceId: ORG, projectId: PROJ, principalUserId: USER, actionId: "action-contract" };
  try {
    const { store } = await seeded(dbPath);
    await store.close();

    const baseline = await authorizeFronteraDispatch(request, { openAuthorityStore: openStore, closeStore: true });
    assert.equal(baseline.allowed, true, "baseline must be allowed before tampering");

    // A — widen a persisted capability token's resource scopes behind the store's back.
    const tamper = openRawSqlite(dbPath);
    const row = tamper
      .prepare("select event_id, payload_json from kernel_authority_events where entity_kind='capability-token' order by sequence asc limit 1")
      .get()!;
    const payload = JSON.parse(row.payload_json);
    payload.resourceScopes = ["project:ANY", projectScope(PROJ)];
    tamper.prepare("update kernel_authority_events set payload_json=? where event_id=?").run(JSON.stringify(payload), row.event_id);
    tamper.close();

    const tampered = await authorizeFronteraDispatch(request, { openAuthorityStore: openStore, closeStore: true });
    assert.equal(tampered.allowed, false, "a tampered authority payload must never be allowed");
    if (!tampered.allowed) assert.equal(tampered.failureClass, "frontera_unavailable");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // B — a revocation whose tail event is deleted must not resurrect authority.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "frontera-tail-"));
  const dbPath2 = path.join(dir2, "kernel-authority.sqlite");
  const openStore2 = (): Promise<KernelAuthorityStore> => openOperatorStore(dbPath2);
  const request2 = { workspaceId: ORG, projectId: PROJ, principalUserId: USER, actionId: "action-contract" };
  try {
    const { store } = await seeded(dbPath2);
    await revokePmfreakDispatchAuthority(store, { organizationId: ORG, principalUserId: USER, projectId: PROJ });
    await store.close();

    const revoked = await authorizeFronteraDispatch(request2, { openAuthorityStore: openStore2, closeStore: true });
    assert.equal(revoked.allowed, false, "an honest revocation denies");

    const truncate = openRawSqlite(dbPath2);
    truncate
      .prepare(
        "delete from kernel_authority_events where entity_kind='capability-token' and sequence=(select max(sequence) from kernel_authority_events where entity_kind='capability-token')",
      )
      .run();
    truncate.close();

    const truncated = await authorizeFronteraDispatch(request2, { openAuthorityStore: openStore2, closeStore: true });
    assert.equal(truncated.allowed, false, "STALE_ALLOW: a lost tail revocation resurrected authority");
  } finally {
    fs.rmSync(dir2, { recursive: true, force: true });
  }
});
