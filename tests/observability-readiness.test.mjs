// Perilla 11 — observability closure: /api/health, /api/ready, and the
// centralized redacting logger (src/lib/observability/logger.ts).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The Supabase env module captures process.env at import time, so readiness
// scenarios that need configured env must set it BEFORE the route module is
// first imported (dynamic imports below share the same module instance).
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://readiness-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key-for-readiness-test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relPath) => readFileSync(path.join(repoRoot, relPath), "utf8");

// ─────────────────────────────────────────────────────────────────────────────
// Logger: structured, level-gated, redacting, never-throwing
// ─────────────────────────────────────────────────────────────────────────────

test("logger emits structured JSON with timestamp/level/message and custom fields", async () => {
  const { logEvent } = await import("../src/lib/observability/logger.ts");
  const lines = [];
  logEvent("info", "unit_test_event", { request_id: "req-1", workspace_id: "ws-1", duration_ms: 12 }, { threshold: "debug", sink: (l) => lines.push(l) });
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.level, "info");
  assert.equal(parsed.message, "unit_test_event");
  assert.equal(parsed.request_id, "req-1");
  assert.equal(parsed.workspace_id, "ws-1");
  assert.ok(parsed.timestamp);
});

test("logger redacts sensitive keys and secret-shaped values (log redaction)", async () => {
  const { logEvent } = await import("../src/lib/observability/logger.ts");
  const lines = [];
  logEvent(
    "error",
    "provider_failure",
    {
      inviteToken: "super-secret-invite-token",
      authorization: "Bearer abcdefghij1234567890",
      nested: { stripe_key: "sk_live_abcdefghij1234567890", note: "call failed with Bearer zyxwvutsrq0987654321" },
      safe: "kept-as-is",
    },
    { threshold: "debug", sink: (l) => lines.push(l) },
  );
  const line = lines[0];
  assert.ok(!line.includes("super-secret-invite-token"), "token value must be redacted");
  assert.ok(!line.includes("sk_live_"), "stripe secret must be redacted");
  assert.ok(!line.includes("abcdefghij1234567890"), "bearer credential must be redacted");
  assert.ok(!line.includes("zyxwvutsrq0987654321"), "secret-shaped substring inside a string must be redacted");
  assert.ok(line.includes("kept-as-is"), "non-sensitive fields must survive");
  assert.ok(line.includes("[redacted]"));
});

test("logger respects LOG_LEVEL threshold and never throws on bad input", async () => {
  const { logEvent, resolveLogLevel } = await import("../src/lib/observability/logger.ts");
  const lines = [];
  logEvent("debug", "below_threshold", {}, { threshold: "info", sink: (l) => lines.push(l) });
  assert.equal(lines.length, 0, "debug below info threshold must be suppressed");
  logEvent("error", "above_threshold", {}, { threshold: "info", sink: (l) => lines.push(l) });
  assert.equal(lines.length, 1);

  assert.equal(resolveLogLevel(undefined), "info");
  assert.equal(resolveLogLevel("DEBUG"), "debug");
  assert.equal(resolveLogLevel("not-a-level"), "info");

  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => logEvent("error", "circular", { circular }, { threshold: "debug", sink: () => {} }));
  assert.doesNotThrow(() =>
    logEvent("error", "sink_explodes", {}, {
      threshold: "debug",
      sink: () => {
        throw new Error("sink down");
      },
    }),
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/health — liveness
// ─────────────────────────────────────────────────────────────────────────────

test("health endpoint responds ok with runtime adapter info and no secrets", async () => {
  const { GET } = await import("../src/app/api/health/route.ts");
  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.app, "pmfreak");
  assert.ok(Array.isArray(body.runtime.adapters));
  const raw = JSON.stringify(body);
  assert.doesNotMatch(raw, /sk_live|sk_test|whsec|service_role|SUPABASE_SERVICE_ROLE/);
});

// ─────────────────────────────────────────────────────────────────────────────
// /api/ready — readiness (configuration + database reachability)
// ─────────────────────────────────────────────────────────────────────────────

test("readiness endpoint returns ready=200 when configuration and database pass", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 200 }));
  const { GET } = await import("../src/app/api/ready/route.ts");
  const response = await GET(new Request("http://localhost/api/ready", { headers: { "x-request-id": "ready-req-1" } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "ready-req-1");
  const body = await response.json();
  assert.equal(body.status, "ready");
  const names = body.checks.map((c) => c.name).sort();
  assert.deepEqual(names, ["configuration", "database"]);
  assert.ok(body.checks.every((c) => c.status === "pass"));
});

test("readiness endpoint returns 503 not_ready when the database is unreachable", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });
  const { GET } = await import("../src/app/api/ready/route.ts");
  const response = await GET(new Request("http://localhost/api/ready"));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, "not_ready");
  const database = body.checks.find((c) => c.name === "database");
  assert.equal(database.status, "fail");
});

test("readiness endpoint times out a hung database check (bounded, no hang)", async (t) => {
  process.env.HEALTHCHECK_DATABASE_TIMEOUT_MS = "100";
  t.after(() => {
    delete process.env.HEALTHCHECK_DATABASE_TIMEOUT_MS;
  });
  t.mock.method(globalThis, "fetch", (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
  );
  const { GET } = await import("../src/app/api/ready/route.ts");
  const startedAt = Date.now();
  const response = await GET(new Request("http://localhost/api/ready"));
  assert.ok(Date.now() - startedAt < 5_000, "readiness must not hang past its timeout");
  assert.equal(response.status, 503);
  const body = await response.json();
  const database = body.checks.find((c) => c.name === "database");
  assert.match(database.detail, /timeout/);
});

test("readiness response exposes env names at most — never values or secrets", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 200 }));
  const { GET } = await import("../src/app/api/ready/route.ts");
  const response = await GET(new Request("http://localhost/api/ready"));
  const raw = JSON.stringify(await response.json());
  assert.ok(!raw.includes(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), "anon key value must never appear");
  assert.doesNotMatch(raw, /sk_live|sk_test|whsec|eyJ[a-zA-Z0-9_-]{10,}/);
  const source = read("src/app/api/ready/route.ts");
  assert.doesNotMatch(source, /process\.env\[[^\]]+\]\s*\}/, "no env VALUE may be interpolated into the response");
});

test("readiness route is registered as a public, non-service-role route", async () => {
  const registry = read("src/lib/security/route-guard-registry.ts");
  assert.match(registry, /src\/app\/api\/ready\/route\.ts/);
});
