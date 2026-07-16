/**
 * Founder Circle Program — transition applier tests.
 *
 * applyFounderProgramTransition must consult the policy before touching the
 * database, map every RPC outcome honestly, and emit audit/analytics events
 * without leaking anything beyond bounded enum values.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { applyFounderProgramTransition } from "../src/lib/founder-program/transitions";

type RpcCall = { fn: string; args: Record<string, unknown> };

function fakeRpcClient(result: unknown, calls: RpcCall[] = []) {
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: result, error: null };
      },
    },
  };
}

const noopDeps = () => {
  const securityEvents: Array<{ event: string; payload: Record<string, unknown> }> = [];
  const analyticsEvents: Array<Record<string, unknown>> = [];
  return {
    securityEvents,
    analyticsEvents,
    logEvent: (async (event: string, payload: Record<string, unknown> = {}) => {
      securityEvents.push({ event, payload });
    }) as never,
    recordEvent: (async (input: Record<string, unknown>) => {
      analyticsEvents.push(input);
      return { ok: true as const };
    }) as never,
  };
};

test("policy violation is rejected before any database call", async () => {
  const { calls, client } = fakeRpcClient("ok");
  const deps = noopDeps();
  const result = await applyFounderProgramTransition(
    { participantId: "p1", from: "approved", to: "onboarding_active", actor: "operator", actorUserId: "op" },
    { client, logEvent: deps.logEvent, recordEvent: deps.recordEvent },
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.code, "invalid_transition");
  assert.equal(calls.length, 0, "RPC must not be called on a forbidden transition");
  assert.equal(deps.securityEvents.length, 0);
});

test("missing reason is rejected before any database call", async () => {
  const { calls, client } = fakeRpcClient("ok");
  const result = await applyFounderProgramTransition(
    { participantId: "p1", from: "activated", to: "paused", actor: "operator", actorUserId: "op" },
    { client },
  );
  assert.equal(result.ok === false && result.code, "reason_required");
  assert.equal(calls.length, 0);
});

test("successful transition passes capacity scope and records both audit channels", async () => {
  const { calls, client } = fakeRpcClient("ok");
  const deps = noopDeps();
  const result = await applyFounderProgramTransition(
    { participantId: "p1", from: "under_review", to: "approved", actor: "operator", actorUserId: "op-1" },
    { client, logEvent: deps.logEvent, recordEvent: deps.recordEvent },
  );
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].fn, "founder_program_transition");
  assert.equal(calls[0].args.p_capacity_scope, "approved");
  assert.equal(calls[0].args.p_capacity_override, false);
  assert.equal(deps.securityEvents.length, 1);
  assert.equal(deps.securityEvents[0].event, "founder_program_transition");
  assert.equal(deps.analyticsEvents.length, 1);
  assert.equal(deps.analyticsEvents[0].eventName, "founder_lifecycle_transition");
});

test("security/analytics payloads carry only bounded enum values", async () => {
  const { client } = fakeRpcClient("ok");
  const deps = noopDeps();
  await applyFounderProgramTransition(
    {
      participantId: "p1",
      from: "under_review",
      to: "rejected",
      actor: "operator",
      actorUserId: "op-1",
      reason: "candidate@example.com sent an unrelated pitch token=abc123",
    },
    { client, logEvent: deps.logEvent, recordEvent: deps.recordEvent },
  );
  const serializedSecurity = JSON.stringify(deps.securityEvents);
  const serializedAnalytics = JSON.stringify(deps.analyticsEvents);
  for (const forbidden of ["candidate@example.com", "token=abc123"]) {
    assert.ok(!serializedSecurity.includes(forbidden), `security event must not carry ${forbidden}`);
    assert.ok(!serializedAnalytics.includes(forbidden), `analytics event must not carry ${forbidden}`);
  }
});

test("RPC outcomes map to explicit failure codes", async () => {
  for (const [rpcResult, expected] of [
    ["capacity_reached", "capacity_reached"],
    ["state_conflict", "state_conflict"],
    ["participant_not_found", "participant_not_found"],
    ["settings_missing", "settings_missing"],
    ["something_unexpected", "transition_failed"],
  ] as const) {
    const { client } = fakeRpcClient(rpcResult);
    const deps = noopDeps();
    const result = await applyFounderProgramTransition(
      { participantId: "p1", from: "under_review", to: "approved", actor: "operator", actorUserId: "op" },
      { client, logEvent: deps.logEvent, recordEvent: deps.recordEvent },
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, expected);
    assert.equal(deps.securityEvents.length, 0, "failed transitions must not log success events");
  }
});

test("RPC transport error maps to transition_failed", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "connection refused" } }),
  };
  const result = await applyFounderProgramTransition(
    { participantId: "p1", from: "under_review", to: "approved", actor: "operator", actorUserId: "op" },
    { client },
  );
  assert.equal(result.ok === false && result.code, "transition_failed");
});

test("capacity override is forwarded and audited", async () => {
  const { calls, client } = fakeRpcClient("ok");
  const deps = noopDeps();
  await applyFounderProgramTransition(
    { participantId: "p1", from: "waitlisted", to: "approved", actor: "operator", actorUserId: "op", capacityOverride: true, reason: "capacity_override" },
    { client, logEvent: deps.logEvent, recordEvent: deps.recordEvent },
  );
  assert.equal(calls[0].args.p_capacity_override, true);
  assert.equal(deps.securityEvents[0].payload.metadata && (deps.securityEvents[0].payload.metadata as Record<string, unknown>).capacity_override, true);
});

test("overlong reasons are truncated before persistence", async () => {
  const { calls, client } = fakeRpcClient("ok");
  await applyFounderProgramTransition(
    { participantId: "p1", from: "under_review", to: "rejected", actor: "operator", actorUserId: "op", reason: "x".repeat(2000) },
    { client, logEvent: (async () => {}) as never, recordEvent: (async () => ({ ok: true as const })) as never },
  );
  assert.equal(String(calls[0].args.p_reason).length, 500);
});
