// Perilla 11 — AI runtime and cost guardrails (beta release closure gate).
//
// Every AI invocation must be bounded: timeout, retry count, per-workspace
// concurrency, daily request/cost ceilings, and agent-chain depth. The
// enforcement chokepoint is src/lib/ai/providers/router.ts runInference();
// the primitives live in src/lib/ai/runtime-limits.ts,
// src/lib/ai/runtime-guardrails.ts and src/lib/ai/usage-accounting.ts.
//
// Behavioral tests exercise the primitives directly (they are dependency-
// injectable); source-contract tests pin the router wiring so a refactor
// cannot silently drop a bound.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAiRuntimeLimits, AI_RUNTIME_LIMIT_DEFAULTS } from "../src/lib/ai/runtime-limits.ts";
import {
  AiGuardrailError,
  assertChainDepthAllowed,
  createWorkspaceConcurrencyGate,
  createProviderCircuitBreaker,
} from "../src/lib/ai/runtime-guardrails.ts";
import { estimateCostUsd, recordAiUsage, getWorkspaceDailyCostUsd } from "../src/lib/ai/usage-accounting.ts";
import { resilientFetch } from "../src/lib/ai/resilient-fetch.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relPath) => readFileSync(path.join(repoRoot, relPath), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// Limits resolution: conservative defaults, hard clamping
// ─────────────────────────────────────────────────────────────────────────────

test("limits: defaults are bounded and conservative", () => {
  const limits = resolveAiRuntimeLimits({});
  assert.deepEqual(limits, AI_RUNTIME_LIMIT_DEFAULTS);
  assert.ok(limits.requestTimeoutMs <= 120_000);
  assert.ok(limits.maxAttempts <= 6);
  assert.ok(limits.maxChainDepth <= 10);
});

test("limits: env overrides apply within safe ranges", () => {
  const limits = resolveAiRuntimeLimits({
    AI_REQUEST_TIMEOUT_MS: "10000",
    AI_MAX_RETRIES: "1",
    AI_MAX_CHAIN_DEPTH: "5",
    AI_MAX_CONCURRENT_PER_WORKSPACE: "2",
    AI_DAILY_REQUEST_LIMIT: "100",
    AI_DAILY_COST_LIMIT_USD: "5.5",
  });
  assert.equal(limits.requestTimeoutMs, 10_000);
  assert.equal(limits.maxAttempts, 2); // 1 retry → 2 attempts
  assert.equal(limits.maxChainDepth, 5);
  assert.equal(limits.maxConcurrentPerWorkspace, 2);
  assert.equal(limits.dailyWorkspaceRequestLimit, 100);
  assert.equal(limits.dailyWorkspaceCostLimitUsd, 5.5);
});

test("limits: unsafe or unparsable env values fall back to defaults, never unbounded", () => {
  for (const raw of ["0", "-1", "abc", "1e99", "Infinity", "NaN", "999999999"]) {
    const limits = resolveAiRuntimeLimits({
      AI_REQUEST_TIMEOUT_MS: raw,
      AI_MAX_RETRIES: raw,
      AI_MAX_CHAIN_DEPTH: raw,
      AI_MAX_CONCURRENT_PER_WORKSPACE: raw,
      AI_DAILY_REQUEST_LIMIT: raw,
      AI_DAILY_COST_LIMIT_USD: raw,
    });
    assert.ok(limits.requestTimeoutMs >= 1_000 && limits.requestTimeoutMs <= 120_000, `timeout unbounded for ${raw}`);
    assert.ok(limits.maxAttempts >= 1 && limits.maxAttempts <= 6, `attempts unbounded for ${raw}`);
    assert.ok(limits.maxChainDepth >= 1 && limits.maxChainDepth <= 10, `depth unbounded for ${raw}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeout aborts the request; retry count is bounded (resilientFetch)
// ─────────────────────────────────────────────────────────────────────────────

test("timeout aborts a hung provider request instead of waiting forever", async (t) => {
  t.mock.method(globalThis, "fetch", (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
  );

  const result = await resilientFetch("https://provider.invalid/v1", { method: "POST" }, {
    timeoutMs: 25,
    maxAttempts: 1,
    operationName: "guardrail-test",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorClass, "timeout");
  assert.equal(result.attempts, 1);
});

test("retry count is bounded at maxAttempts even when the provider keeps failing", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: "boom" } }), { status: 500 });
  });

  const result = await resilientFetch("https://provider.invalid/v1", { method: "POST" }, {
    timeoutMs: 1_000,
    maxAttempts: 3,
    retryDelayMs: 1,
    operationName: "guardrail-test",
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 3, "provider must be called exactly maxAttempts times");
  assert.equal(result.attempts, 3);
});

test("non-retryable provider errors stop immediately (no infinite loop on 401)", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 });
  });

  const result = await resilientFetch("https://provider.invalid/v1", { method: "POST" }, {
    timeoutMs: 1_000,
    maxAttempts: 5,
    retryDelayMs: 1,
    operationName: "guardrail-test",
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorClass, "auth_error");
  assert.equal(calls, 1);
});

test("provider error surfaces no secrets: resilient-fetch logs domain only, never headers/keys", () => {
  const source = read("src/lib/ai/resilient-fetch.ts");
  assert.match(source, /domainOnly\(url\)/, "log lines must use the domain, not the full URL");
  assert.doesNotMatch(source, /console\.[a-z]+\([^)]*(Authorization|apiKey|api_key|OPENAI_API_KEY)/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent chain depth
// ─────────────────────────────────────────────────────────────────────────────

test("agent chain depth cannot exceed the configured limit", () => {
  assert.doesNotThrow(() => assertChainDepthAllowed(0, 3));
  assert.doesNotThrow(() => assertChainDepthAllowed(2, 3));
  assert.throws(() => assertChainDepthAllowed(3, 3), AiGuardrailError);
  assert.throws(() => assertChainDepthAllowed(50, 3), AiGuardrailError);
  assert.throws(() => assertChainDepthAllowed(-1, 3), AiGuardrailError);
  assert.throws(() => assertChainDepthAllowed(1.5, 3), AiGuardrailError);
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-workspace concurrency
// ─────────────────────────────────────────────────────────────────────────────

test("workspace concurrency is bounded and releases correctly", () => {
  const gate = createWorkspaceConcurrencyGate();
  const releaseA1 = gate.acquire("ws-a", 2);
  const releaseA2 = gate.acquire("ws-a", 2);
  assert.equal(gate.inFlight("ws-a"), 2);

  assert.throws(() => gate.acquire("ws-a", 2), AiGuardrailError, "third concurrent request must be denied");
  // Another workspace is unaffected (isolation).
  const releaseB = gate.acquire("ws-b", 2);

  releaseA1();
  assert.equal(gate.inFlight("ws-a"), 1);
  const releaseA3 = gate.acquire("ws-a", 2);

  // Double-release must not corrupt the counter.
  releaseA1();
  assert.equal(gate.inFlight("ws-a"), 2);

  releaseA2();
  releaseA3();
  releaseB();
  assert.equal(gate.inFlight("ws-a"), 0);
  assert.equal(gate.inFlight("ws-b"), 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Circuit breaker: repeated failures trip it; cooldown half-opens it
// ─────────────────────────────────────────────────────────────────────────────

test("circuit breaker opens after repeated provider failures and fails fast", () => {
  let clock = 0;
  const breaker = createProviderCircuitBreaker({ failureThreshold: 3, cooldownMs: 1_000, now: () => clock });

  for (let i = 0; i < 3; i += 1) {
    breaker.assertCallAllowed("openai");
    breaker.recordFailure("openai");
  }
  assert.equal(breaker.state("openai"), "open");
  assert.throws(() => breaker.assertCallAllowed("openai"), AiGuardrailError, "open circuit must fail fast");

  // Cooldown elapses → half-open: exactly one probe allowed.
  clock = 1_001;
  assert.equal(breaker.state("openai"), "half_open");
  breaker.assertCallAllowed("openai");
  assert.throws(() => breaker.assertCallAllowed("openai"), AiGuardrailError, "only one half-open probe may fly");

  // Probe succeeds → circuit closes.
  breaker.recordSuccess("openai");
  assert.equal(breaker.state("openai"), "closed");
  breaker.assertCallAllowed("openai");
});

test("circuit breaker re-opens when the half-open probe fails (no infinite retry loop)", () => {
  let clock = 0;
  const breaker = createProviderCircuitBreaker({ failureThreshold: 2, cooldownMs: 500, now: () => clock });
  breaker.recordFailure("openai");
  breaker.recordFailure("openai");
  assert.equal(breaker.state("openai"), "open");

  clock = 600;
  breaker.assertCallAllowed("openai"); // half-open probe
  breaker.recordFailure("openai");
  assert.equal(breaker.state("openai"), "open", "failed probe must re-open the circuit");
  assert.throws(() => breaker.assertCallAllowed("openai"), AiGuardrailError);

  // Breakers are per-provider: a different provider is unaffected.
  breaker.assertCallAllowed("anthropic");
});

// ─────────────────────────────────────────────────────────────────────────────
// Cost accounting
// ─────────────────────────────────────────────────────────────────────────────

test("estimateCostUsd prices known models and returns null (not 0) for unknown ones", () => {
  const cost = estimateCostUsd("gpt-4.1-mini", 1_000_000, 1_000_000);
  assert.equal(cost, 2.0); // 0.40 input + 1.60 output
  assert.equal(estimateCostUsd("some-unknown-model", 1000, 1000), null);
  assert.equal(estimateCostUsd("gpt-4.1-mini", undefined, undefined), null);
});

test("recordAiUsage writes an accounting row (audit record is generated)", async () => {
  const inserted = [];
  const client = {
    from(table) {
      assert.equal(table, "ai_usage_events");
      return {
        async insert(row) {
          inserted.push(row);
          return { error: null };
        },
      };
    },
  };

  await recordAiUsage(
    {
      provider: "openai",
      model: "gpt-4.1-mini",
      workspaceId: "ws-1",
      userId: "u-1",
      operation: "message-nudges",
      inputTokens: 1200,
      outputTokens: 400,
      estimatedCostUsd: estimateCostUsd("gpt-4.1-mini", 1200, 400),
      status: "success",
      durationMs: 850,
    },
    () => client,
  );

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].workspace_id, "ws-1");
  assert.equal(inserted[0].status, "success");
  assert.ok(inserted[0].estimated_cost_usd > 0);
});

test("recordAiUsage never throws into the caller when accounting fails", async () => {
  await assert.doesNotReject(() =>
    recordAiUsage(
      { provider: "openai", model: "m", operation: "op", estimatedCostUsd: null, status: "error" },
      () => {
        throw new Error("accounting exploded");
      },
    ),
  );
});

test("getWorkspaceDailyCostUsd sums the day's estimated cost; null when unavailable", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async gte() {
                  return { data: [{ estimated_cost_usd: 1.25 }, { estimated_cost_usd: null }, { estimated_cost_usd: 0.75 }], error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  assert.equal(await getWorkspaceDailyCostUsd("ws-1", () => client), 2.0);
  assert.equal(await getWorkspaceDailyCostUsd("ws-1", () => null), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Router wiring (source contract): all inference paths converge on
// runInference, so the bounds below cannot be bypassed by any AI route.
// ─────────────────────────────────────────────────────────────────────────────

test("router enforces chain depth, daily ceilings, concurrency, breaker, and accounting", () => {
  const source = read("src/lib/ai/providers/router.ts");
  assert.match(source, /assertChainDepthAllowed\(request\.chainDepth, limits\.maxChainDepth\)/);
  assert.match(source, /scope: "ai\.workspace_daily_requests"/);
  assert.match(source, /daily_request_ceiling/);
  assert.match(source, /getWorkspaceDailyCostUsd\(request\.workspaceId\)/);
  assert.match(source, /daily_cost_ceiling/);
  assert.match(source, /workspaceConcurrencyGate\.acquire\(/);
  assert.match(source, /providerCircuitBreaker\.assertCallAllowed\(/);
  assert.match(source, /providerCircuitBreaker\.recordFailure\(/);
  assert.match(source, /providerCircuitBreaker\.recordSuccess\(/);
  assert.match(source, /recordAiUsage\(/);
  // Defaults applied when the caller sets no tighter bounds.
  assert.match(source, /timeoutMs: request\.timeoutMs \?\? limits\.requestTimeoutMs/);
  assert.match(source, /maxAttempts: request\.maxAttempts \?\? limits\.maxAttempts/);
});

test("daily request ceiling fails closed (abuse store) and cost ceiling blocks when reached", () => {
  const source = read("src/lib/ai/providers/router.ts");
  const dailyBlock = source.match(/const daily = await enforceAbuseLimit\(\{[\s\S]*?\}\);[\s\S]*?if \(!daily\.allowed\)[\s\S]*?daily_request_ceiling/);
  assert.ok(dailyBlock, "daily request ceiling must deny when the abuse store denies");
  const costBlock = source.match(/spentUsd !== null && spentUsd >= limits\.dailyWorkspaceCostLimitUsd/);
  assert.ok(costBlock, "cost ceiling must block once the daily estimate reaches the limit");
});

test("ai_usage_events migration is service-role-only with the workspace/day index", () => {
  const sql = read("supabase/migrations/20260821000000_ai_usage_events.sql").toLowerCase();
  assert.match(sql, /create table if not exists public\.ai_usage_events/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /revoke all on public\.ai_usage_events from authenticated/);
  assert.match(sql, /create index if not exists ai_usage_events_workspace_created_at/);
});
