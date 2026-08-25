/**
 * P0-PKG-06 — the PMFreak -> Frontera enforcement boundary, proven against the
 * REAL packaged `@aoc-enterprise/runtime@1.1.0` artifact.
 *
 * Every decision asserted here is produced by the genuine `AocKernel` reading a
 * genuine durable `KernelAuthorityStore`. Nothing stubs `allowed: true`. The
 * only thing mocked is the Supabase client, and only so the dispatch RPC can be
 * COUNTED — which is the whole point: a boundary that fails closed is one where
 * that count is zero.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  openOperatorStore,
  provisionPmfreakDispatchAuthority,
  revokePmfreakDispatchAuthority,
} from "../scripts/frontera-authority-provisioning.mjs";
import { authorizeFronteraDispatch } from "@/lib/integrations/frontera";
import { dispatchGovernedMaterialActionToTask } from "@/lib/operational-flow/operational-flow-service";

const WS_A = "workspace-aaaa";
const WS_B = "workspace-bbbb";
const PROJ_A = "project-aaaa";
const PROJ_B = "project-bbbb";
const USER_A = "user-aaaa";
const ACTION = "action-1111";

/** Counts dispatch RPC calls. Returns whatever the RPC would have returned. */
function rpcSpy(data: Record<string, unknown> = { disposition: "created", task: { id: "task-1" } }) {
  const calls: Array<{ name: string; args: unknown }> = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data, error: null };
      },
    } as never,
  };
}

const scope = (over: Partial<{ workspaceId: string; projectId: string; userId: string; role: string }> = {}) => ({
  workspaceId: over.workspaceId ?? WS_A,
  projectId: over.projectId ?? PROJ_A,
  userId: over.userId ?? USER_A,
  role: over.role ?? "owner",
});

/** A store seeded with exactly one principal authorized for one project. */
async function seededStore() {
  const store = await openOperatorStore();
  await provisionPmfreakDispatchAuthority(store, {
    organizationId: WS_A,
    principalUserId: USER_A,
    projectId: PROJ_A,
  });
  return store;
}

const withStore = (store: unknown) => ({ openAuthorityStore: async () => store as never });

test("Frontera ALLOW: an operator-provisioned principal dispatches, and the RPC runs exactly once", async () => {
  const store = await seededStore();
  const spy = rpcSpy();
  const result = await dispatchGovernedMaterialActionToTask(spy.client, scope(), { actionId: ACTION }, {
    fronteraDeps: withStore(store),
  });
  assert.equal(spy.calls.length, 1, "dispatch RPC called exactly once");
  assert.equal(spy.calls[0].name, "dispatch_governed_action_to_internal_task");
  assert.equal((result as Record<string, unknown>).disposition, "created");
  assert.ok((result as Record<string, unknown>).fronteraDecisionId, "Frontera decision correlated onto the result");
  assert.equal(
    (result as Record<string, unknown>).fronteraReasonCodes,
    undefined,
    "Frontera reason codes stay server-side",
  );
  await store.close();
});

test("Frontera DENY (wrong project): zero dispatch RPC calls", async () => {
  const store = await seededStore();
  const spy = rpcSpy();
  const result = await dispatchGovernedMaterialActionToTask(
    spy.client,
    scope({ projectId: PROJ_B }),
    { actionId: ACTION },
    { fronteraDeps: withStore(store) },
  );
  assert.equal(spy.calls.length, 0, "FRONTERA_DENY_DISPATCHED_TASK");
  assert.equal((result as Record<string, unknown>).disposition, "denied");
  assert.equal((result as Record<string, unknown>).failureClass, "frontera_denied");
  await store.close();
});

test("Frontera DENY (unknown external subject): zero dispatch RPC calls, no actor minted", async () => {
  const store = await seededStore();
  const spy = rpcSpy();
  const result = await dispatchGovernedMaterialActionToTask(
    spy.client,
    scope({ userId: "user-never-bound" }),
    { actionId: ACTION },
    { fronteraDeps: withStore(store) },
  );
  assert.equal(spy.calls.length, 0);
  assert.equal((result as Record<string, unknown>).failureClass, "frontera_actor_unbound");
  // The unbound principal is still unbound: resolving it did not create it.
  const after = await store.findActorByExternalSubject(
    { system: false, organizationId: WS_A },
    WS_A,
    { system: "pmfreak", subjectId: "user-never-bound" },
  );
  assert.equal(after, null, "resolution must never mint an actor");
  await store.close();
});

test("cross-organization: workspace B cannot consume workspace A authority", async () => {
  const store = await seededStore();
  const spy = rpcSpy();
  const result = await dispatchGovernedMaterialActionToTask(
    spy.client,
    // Same external subject id, different workspace -> different organization.
    scope({ workspaceId: WS_B }),
    { actionId: ACTION },
    { fronteraDeps: withStore(store) },
  );
  assert.equal(spy.calls.length, 0, "CROSS_TENANT_AUTHORITY_LEAK");
  assert.equal((result as Record<string, unknown>).failureClass, "frontera_actor_unbound");
  await store.close();
});

test("Frontera ERROR (store unavailable): zero dispatch RPC calls", async () => {
  const spy = rpcSpy();
  const result = await dispatchGovernedMaterialActionToTask(spy.client, scope(), { actionId: ACTION }, {
    fronteraDeps: {
      openAuthorityStore: async () => {
        throw new Error("authority store unreachable");
      },
    },
  });
  assert.equal(spy.calls.length, 0, "FRONTERA_ERROR_DISPATCHED_TASK");
  assert.equal((result as Record<string, unknown>).failureClass, "frontera_unavailable");
});

test("Frontera malformed result: zero dispatch RPC calls", async () => {
  const spy = rpcSpy();
  const result = await dispatchGovernedMaterialActionToTask(spy.client, scope(), { actionId: ACTION }, {
    authorizeDispatch: async () =>
      ({ allowed: false, failureClass: "frontera_malformed_result", reasonCodes: ["FRONTERA_MALFORMED_RESULT"] }) as never,
  });
  assert.equal(spy.calls.length, 0);
  assert.equal((result as Record<string, unknown>).failureClass, "frontera_malformed_result");
});

test("external subject binding is explicit: the Frontera actor id is NOT the PMFreak user id", async () => {
  const store = await seededStore();
  const decision = await authorizeFronteraDispatch(
    { workspaceId: WS_A, projectId: PROJ_A, principalUserId: USER_A, actionId: ACTION },
    withStore(store),
  );
  assert.equal(decision.allowed, true);
  if (decision.allowed) {
    assert.notEqual(decision.fronteraActorId, USER_A, "actor id must come from Frontera, not be assumed equal");
    assert.ok(decision.trustDomainId, "trust domain comes from the durable actor record");
  }
  await store.close();
});

test("the product evaluation path performs no provisioning write", async () => {
  const store = await seededStore();
  const read = { system: false as const, organizationId: WS_A };
  const before = await store.listRecords(read, { organizationId: WS_A });
  await authorizeFronteraDispatch(
    { workspaceId: WS_A, projectId: PROJ_A, principalUserId: USER_A, actionId: ACTION },
    withStore(store),
  );
  // Even an evaluation that DENIES must not create anything.
  await authorizeFronteraDispatch(
    { workspaceId: WS_A, projectId: PROJ_A, principalUserId: "user-never-bound", actionId: ACTION },
    withStore(store),
  );
  const after = await store.listRecords(read, { organizationId: WS_A });
  assert.equal(after.length, before.length, "evaluation mutated Frontera authority state");
  await store.close();
});

/**
 * §41's strongest proof, and the one that shows the original P0-PKG-06 blocker
 * is genuinely closed rather than relocated: durable authority, written by an
 * operator in one store handle, observed across a CLOSE/REOPEN process
 * boundary, and revocable so that a stale ALLOW is impossible.
 */
test("SQLite durability: authority survives reopen, and an external revocation denies on the next dispatch", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frontera-authority-"));
  const dbPath = path.join(dir, "kernel-authority.sqlite");
  try {
    // ---- operator process: provision, then close the store entirely ----
    const provisioning = await openOperatorStore(dbPath);
    await provisionPmfreakDispatchAuthority(provisioning, {
      organizationId: WS_A,
      principalUserId: USER_A,
      projectId: PROJ_A,
    });
    await provisioning.close();

    // ---- application: a fresh store handle, nothing carried over in memory ----
    const spyAllow = rpcSpy();
    const allowed = await dispatchGovernedMaterialActionToTask(
      spyAllow.client,
      scope(),
      { actionId: ACTION },
      { fronteraDeps: { openAuthorityStore: () => openOperatorStore(dbPath), closeStore: true } },
    );
    assert.equal((allowed as Record<string, unknown>).disposition, "created");
    assert.equal(spyAllow.calls.length, 1, "durable authority survives a process boundary");

    // ---- operator process again: revoke out of band ----
    const revoking = await openOperatorStore(dbPath);
    await revokePmfreakDispatchAuthority(revoking, {
      organizationId: WS_A,
      principalUserId: USER_A,
      projectId: PROJ_A,
    });
    await revoking.close();

    // ---- application: the very next dispatch must observe the revocation ----
    const spyDeny = rpcSpy();
    const denied = await dispatchGovernedMaterialActionToTask(
      spyDeny.client,
      scope(),
      { actionId: ACTION },
      { fronteraDeps: { openAuthorityStore: () => openOperatorStore(dbPath), closeStore: true } },
    );
    assert.equal(spyDeny.calls.length, 0, "STALE_ALLOW_AFTER_REVOCATION");
    assert.equal((denied as Record<string, unknown>).disposition, "denied");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a denial does not leak Frontera authority detail to the caller", async () => {
  const store = await seededStore();
  const spy = rpcSpy();
  const result = (await dispatchGovernedMaterialActionToTask(
    spy.client,
    scope({ projectId: PROJ_B }),
    { actionId: ACTION },
    { fronteraDeps: withStore(store) },
  )) as Record<string, unknown>;
  assert.equal(spy.calls.length, 0);
  assert.equal(result.fronteraReasonCodes, undefined, "reason codes must not reach the client");
  assert.equal(result.diagnostic, undefined, "infrastructure diagnostics must not reach the client");
  assert.equal(result.reason, "frontera_enforcement_denied");
  await store.close();
});
