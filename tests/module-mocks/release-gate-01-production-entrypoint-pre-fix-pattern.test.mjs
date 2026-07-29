/**
 * Release Gate 01 — behavior-level regression test against the actual,
 * pre-existing production entry points, not the new `buildAuthUserContext`
 * helper in isolation.
 *
 * `tests/release-gate-01-auth-session-persistence.test.mjs` proves the unit
 * seam (assertRuntimeAuthContinuity's injected-deps contract) but its
 * "REGRESSION (pre-fix behavior)" case calls two hand-built fake clients
 * directly — it never invokes `assertRuntimeAuthContinuity()` or
 * `getAuthUser()`/`requireAuthUser()` themselves. That leaves a gap: it
 * demonstrates the fake double can model the bug, not that the real,
 * shipped entry points exhibit it.
 *
 * This file closes that gap for the PRE-FIX call pattern. It imports the
 * REAL, unmodified `createSupabaseServerClient` (src/lib/supabase/server.ts),
 * `assertRuntimeAuthContinuity` (called with its real zero-arg production
 * signature, not the injected-deps test seam), and `getAuthUser` /
 * `requireAuthUser` (src/lib/auth.ts) — all pre-existing exports that
 * (protected)/layout.tsx actually calls in production; on origin/main
 * commit 58de7dae8ca8e98f7da4a5c76349c17ae837110a it called
 * assertRuntimeAuthContinuity() followed by requireAuthUser() as two
 * separate, uncoordinated getUser() calls, which is exactly what this test
 * reconstructs. The ONLY things mocked are the true I/O boundary:
 * `next/headers`'s `cookies()`/`headers()` and `@supabase/ssr`'s
 * `createServerClient` (the GoTrue HTTP client). Because the mock sits
 * below `createSupabaseServerClient`, its real cookie adapter — including
 * the try/catch that silently swallows a write in a Server Component
 * render context — actually executes.
 *
 * This is a separate `node --test` file (not a second `test()` in the
 * companion fixed-pattern file) on purpose: `node --test` runs each file in
 * its own child process, so `t.mock.module`'s effect on `@supabase/ssr`
 * actually reaches `src/lib/supabase/server.ts`'s import binding, which is
 * resolved once per process the first time that module is evaluated.
 * Sharing a process with another test that also exercises this import
 * chain would silently pin both to whichever mock ran first.
 *
 * This file lives under tests/module-mocks/ (not tests/) and is run via a
 * dedicated `npm test` step (see package.json) that adds Node's
 * `--experimental-test-module-mocks` flag, scoped to only this directory.
 * That flag isn't needed by, and is deliberately kept off, the other ~500
 * pre-existing test files' invocation — it changes Node's ESM loader
 * behavior process-wide for every file it's passed to, and there's no
 * reason for files that don't call `mock.module`/`t.mock.module` to run
 * under an experimental loader hook they don't use.
 *
 * See docs/audits/remediation/release-gate-01-auth-session-persistence.md
 * for the full root-cause writeup this test corroborates behaviorally.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, makeFakeGoTrueFactory, mockModuleExports } from "./release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

test("PRE-FIX PATTERN: assertRuntimeAuthContinuity() followed by a second, independent getAuthUser() call loses the session and requireAuthUser() redirects to /login, despite a genuinely authenticated first call", async (t) => {
  const jar = makeCookieJar({ writesSucceed: false }); // Server Component render: writes are swallowed
  jar.seed("sb-access-token", "access-1-expired");
  jar.seed("sb-refresh-token", "refresh-1");

  mockModuleExports(t, "next/headers", {
    cookies: async () => jar,
    headers: async () => ({ get: (name) => (name === "x-pathname" ? "/command-center" : null) }),
  });
  mockModuleExports(t, "@supabase/ssr", { createServerClient: makeFakeGoTrueFactory() });

  const { assertRuntimeAuthContinuity } = await import("../../src/lib/auth/runtime-auth-continuity.ts");
  const { getAuthUser, requireAuthUser } = await import("../../src/lib/auth.ts");

  // Call #1: the real production zero-arg assertRuntimeAuthContinuity(),
  // exactly as (protected)/layout.tsx invokes it.
  const continuity = await assertRuntimeAuthContinuity();
  assert.equal(continuity.ok, true, "the request genuinely started out authenticated");
  assert.equal(continuity.userId, "user-1");

  // The write from call #1's on-demand refresh was swallowed: the jar still
  // holds the OLD, now-consumed refresh token. This is the actual
  // createSupabaseServerClient cookie-adapter code executing, not an
  // assertion about it.
  assert.equal(
    jar.getAll().find((c) => c.name === "sb-refresh-token")?.value,
    "refresh-1",
    "swallowed write must leave the pre-refresh token in the cookie jar",
  );

  // Call #2: this is what the PRE-FIX (protected)/layout.tsx did next —
  // requireAuthUser() -> getAuthUser() -> a second, independent
  // createSupabaseServerClient()/getUser() call. Real, unmodified,
  // pre-existing exports; only the I/O boundary is mocked.
  const secondCallUser = await getAuthUser();
  assert.equal(
    secondCallUser,
    null,
    "the second independent getUser() call presents the already-consumed refresh token and is rejected",
  );

  // requireAuthUser() is the actual call site (protected)/layout.tsx used
  // pre-fix. Confirm it does what the production symptom reported: bounces
  // an already-authenticated request to /login.
  await assert.rejects(
    () => requireAuthUser(),
    (err) => {
      assert.match(err.digest ?? "", /^NEXT_REDIRECT;replace;\/login\?next=/, "requireAuthUser() must redirect to /login");
      return true;
    },
    "an authenticated request's second getUser() call must not silently succeed — it must trigger the /login redirect symptom",
  );
});
