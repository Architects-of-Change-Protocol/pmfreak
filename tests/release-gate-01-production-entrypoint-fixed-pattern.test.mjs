/**
 * Release Gate 01 — companion to
 * tests/release-gate-01-production-entrypoint-pre-fix-pattern.test.mjs.
 * Read that file's header first for why this is a separate `node --test`
 * file rather than a second `test()` alongside the pre-fix one (short
 * version: process isolation is required for `t.mock.module("@supabase/ssr",
 * ...)` to actually take effect on `src/lib/supabase/server.ts`'s import).
 *
 * This exercises the FIXED call pattern using the same real, pre-existing
 * production entry points and the same swallow-on-write cookie hazard (the
 * jar here still refuses to persist writes, exactly like a Server Component
 * render) — only the call SHAPE changes, matching current
 * `(protected)/layout.tsx`: one `assertRuntimeAuthContinuity()` call, then
 * `buildAuthUserContext(continuity.user)` mapping its already-resolved user
 * directly, with no second `getUser()` round trip.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, makeFakeGoTrueFactory } from "./helpers/release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

test("FIXED PATTERN: a single assertRuntimeAuthContinuity() call plus buildAuthUserContext() resolves the same session with no second getUser() call, and no login redirect", async (t) => {
  const jar = makeCookieJar({ writesSucceed: false }); // same hazard present: writes still swallowed
  jar.seed("sb-access-token", "access-1-expired");
  jar.seed("sb-refresh-token", "refresh-1");

  let createServerClientCalls = 0;
  const realFactory = makeFakeGoTrueFactory();
  t.mock.module("next/headers", {
    namedExports: {
      cookies: async () => jar,
      headers: async () => ({ get: () => "/command-center" }),
    },
  });
  t.mock.module("@supabase/ssr", {
    namedExports: {
      createServerClient: (...args) => {
        createServerClientCalls += 1;
        return realFactory(...args);
      },
    },
  });

  const { assertRuntimeAuthContinuity } = await import("../src/lib/auth/runtime-auth-continuity.ts");
  const { buildAuthUserContext } = await import("../src/lib/auth.ts");

  // This is byte-for-byte the fixed (protected)/layout.tsx contract: one
  // continuity call, then a pure mapping of its already-resolved user —
  // never a second getUser() round trip.
  const continuity = await assertRuntimeAuthContinuity();
  assert.equal(continuity.ok, true);
  const user = continuity.user ? buildAuthUserContext(continuity.user) : null;

  assert.ok(user, "the fixed path must still resolve an authenticated user");
  assert.equal(user.id, "user-1");
  assert.equal(user.email, "uat@example.com");
  assert.equal(createServerClientCalls, 1, "the fixed request path must make exactly one Supabase client / getUser() call");
});
