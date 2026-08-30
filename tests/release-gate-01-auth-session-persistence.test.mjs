/**
 * Release Gate 01 — production P1: an authenticated PMFreak user was
 * redirected to /login mid-session, with all auth cookies subsequently gone
 * from the browser, despite never signing out. Reproduced live against
 * origin/main 58de7dae8ca8e98f7da4a5c76349c17ae837110a on the
 * https://pmfreak.com/ production deployment. See
 * docs/audits/remediation/release-gate-01-auth-session-persistence.md for
 * full root-cause analysis and docs/audits/pmfreak-release-gate-01.md for
 * the gate report.
 *
 * Root cause: `src/app/(protected)/layout.tsx` made TWO independent,
 * uncoordinated server-side `getUser()` calls per request —
 * `assertRuntimeAuthContinuity()` (its own Supabase client) followed by
 * `requireAuthUser()` -> `getAuthUser()` (a SECOND, separate Supabase
 * client). `src/lib/supabase/server.ts`'s cookie adapter silently swallows
 * write failures ("Server Components can read cookies, but may not be
 * allowed to write them"), which is correct/necessary for plain Server
 * Component rendering — but it means that if the access token was expired,
 * the FIRST getUser() call's on-demand token refresh could not be persisted
 * back to cookies. Supabase rotates (invalidates) the refresh token
 * server-side as soon as it's used, regardless of whether the client
 * manages to persist the replacement. The SECOND getUser() call then
 * presents that same, now-already-consumed refresh token and is rejected
 * outright ("Invalid Refresh Token: Already Used", a genuine 401) —
 * `requireAuthUser()` treats that as "not authenticated" and redirects to
 * /login. Once that dead refresh token is subsequently presented to
 * middleware, Supabase's own SIGNED_OUT handling proactively clears every
 * stored auth cookie via the (correctly-wired, non-swallowing) middleware
 * cookie adapter — which is exactly the "cookie table was completely
 * empty" symptom observed in production DevTools.
 *
 * Fix: `assertRuntimeAuthContinuity()` now returns the resolved Supabase
 * user, and `(protected)/layout.tsx` builds the full AuthUserContext
 * directly from it via the new `buildAuthUserContext()` (src/lib/auth.ts)
 * instead of making a second, independent getUser() call. Exactly one
 * getUser() call happens per request in the protected layout, so there is
 * only ever one refresh attempt to potentially lose, and reusing its
 * already-resolved user never depends on a second network round trip at
 * all.
 *
 * These tests exercise the real, exported `assertRuntimeAuthContinuity`
 * and `buildAuthUserContext` functions (not source-text regexes) against a
 * fake Supabase auth double that faithfully models real refresh-token
 * rotation semantics: a refresh token is single-use, and a session refresh
 * that can't be persisted leaves the caller with the same, now-consumed
 * refresh token for the next attempt.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { assertRuntimeAuthContinuity } from "../src/lib/auth/runtime-auth-continuity.ts";
import { buildAuthUserContext } from "../src/lib/auth.ts";

// Models one Supabase project's auth server: an access token expires after
// `accessTokenTtlMs`; using an expired access token via getUser() triggers
// an on-demand refresh using the currently-stored refresh token. Refresh
// tokens are single-use — reusing an already-consumed one is a genuine
// auth rejection (401 "Invalid Refresh Token: Already Used"), exactly
// mirroring real Supabase/GoTrue behavior.
function makeFakeAuthServer({ userId = "user-1", email = "uat@example.com" } = {}) {
  const consumedRefreshTokens = new Set();
  let currentAccessToken = { token: "access-1", refreshToken: "refresh-1", expired: true };

  // A "client" whose cookie writes are swallowed (Server Component render
  // context) never persists a refreshed token anywhere another client can
  // see it — modeled by simply not touching `currentAccessToken` on refresh.
  function makeClient({ persistsRefresh }) {
    return {
      getUser: async () => {
        const presented = currentAccessToken;
        if (!presented.expired) {
          return { data: { user: { id: userId, email, user_metadata: {} } }, error: null };
        }
        if (consumedRefreshTokens.has(presented.refreshToken)) {
          return {
            data: { user: null },
            error: { status: 401, message: "Invalid Refresh Token: Already Used" },
          };
        }
        consumedRefreshTokens.add(presented.refreshToken);
        const refreshed = { token: `access-${presented.refreshToken}-next`, refreshToken: `${presented.refreshToken}-next`, expired: false };
        if (persistsRefresh) {
          currentAccessToken = refreshed;
        }
        return { data: { user: { id: userId, email, user_metadata: {} } }, error: null };
      },
      getSession: async () => ({ data: { session: null } }),
    };
  }

  return {
    // A client whose setAll cookie write always succeeds (middleware, a
    // Server Action, a Route Handler).
    makePersistingClient: () => makeClient({ persistsRefresh: true }),
    // A client whose setAll cookie write is silently swallowed (a plain
    // Server Component render) — the exact src/lib/supabase/server.ts hazard.
    makeNonPersistingClient: () => makeClient({ persistsRefresh: false }),
  };
}

test("assertRuntimeAuthContinuity calls getUser() exactly once and returns the resolved user", async () => {
  const server = makeFakeAuthServer();
  const client = server.makeNonPersistingClient();
  let getUserCalls = 0;
  const report = await assertRuntimeAuthContinuity({
    getUser: async () => {
      getUserCalls += 1;
      return client.getUser();
    },
    getSession: client.getSession,
    getPathname: async () => "/create-command-center",
    getAuthCookieNames: async () => ["sb-project-auth-token"],
  });

  assert.equal(getUserCalls, 1, "assertRuntimeAuthContinuity must call getUser() exactly once");
  assert.equal(report.ok, true);
  assert.equal(report.user?.id, "user-1");
  assert.equal(report.userId, "user-1");
});

test("buildAuthUserContext maps the continuity-resolved user without a second getUser() call", async () => {
  // This is the actual fixed (protected)/layout.tsx contract: one getUser()
  // call total for the request, then a pure, network-free mapping.
  const server = makeFakeAuthServer({ userId: "user-2", email: "gate01@example.com" });
  const client = server.makeNonPersistingClient();
  let getUserCalls = 0;

  const continuity = await assertRuntimeAuthContinuity({
    getUser: async () => {
      getUserCalls += 1;
      return client.getUser();
    },
    getSession: client.getSession,
    getPathname: async () => "/command-center",
    getAuthCookieNames: async () => [],
  });

  assert.equal(continuity.ok, true);
  const authUser = continuity.user ? buildAuthUserContext(continuity.user) : null;

  assert.equal(getUserCalls, 1, "building the AuthUserContext must not trigger any additional getUser() call");
  assert.ok(authUser, "a resolved continuity user must map to a non-null AuthUserContext");
  assert.equal(authUser.id, "user-2");
  assert.equal(authUser.email, "gate01@example.com");
});

test("REGRESSION (pre-fix behavior): two independent, uncoordinated getUser() calls against a non-persisting client corrupt the session", async () => {
  // This models exactly what the pre-fix (protected)/layout.tsx did:
  // assertRuntimeAuthContinuity() using its own client, immediately followed
  // by a second, independent requireAuthUser()/getAuthUser() call using a
  // SEPARATE client instance — both backed by the same underlying cookie
  // jar, and both unable to persist a refresh (Server Component context).
  const server = makeFakeAuthServer({ userId: "user-3" });
  const firstClient = server.makeNonPersistingClient();
  const secondClient = server.makeNonPersistingClient();

  const firstCall = await firstClient.getUser();
  assert.equal(firstCall.data.user?.id, "user-3", "the first call succeeds using the in-memory refresh");

  const secondCall = await secondClient.getUser();
  assert.equal(secondCall.data.user, null, "the second, independent call is rejected: its refresh token was already consumed by the first call");
  assert.equal(secondCall.error?.status, 401);
  assert.match(secondCall.error?.message ?? "", /Already Used/);
});

test("fixed contract: a single shared getUser() call never hits the already-used-refresh-token failure", async () => {
  const server = makeFakeAuthServer({ userId: "user-4" });
  const client = server.makeNonPersistingClient();

  // Only one call is ever made against this client for the request, exactly
  // as (protected)/layout.tsx now does via assertRuntimeAuthContinuity.
  const onlyCall = await client.getUser();
  assert.equal(onlyCall.data.user?.id, "user-4");
  assert.equal(onlyCall.error, null);
});

test("assertRuntimeAuthContinuity: genuine auth rejection (no fallback) returns ok:false, not a crash", async () => {
  const report = await assertRuntimeAuthContinuity({
    getUser: async () => ({ data: { user: null }, error: { name: "AuthApiError", status: 401, message: "Invalid Refresh Token: Already Used" } }),
    getSession: async () => ({ data: { session: null } }),
    getPathname: async () => "/command-center",
    getAuthCookieNames: async () => [],
  });
  assert.equal(report.ok, false);
  assert.equal(report.user, null);
  assert.equal(report.userId, null);
  assert.deepEqual(report.issues, ["auth_rejected"]);
});

test("assertRuntimeAuthContinuity: transient network error falls back to a valid local session (unchanged prior behavior)", async () => {
  const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
  const report = await assertRuntimeAuthContinuity({
    getUser: async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } }),
    getSession: async () => ({ data: { session: { user: { id: "user-5", email: "x@example.com" }, expires_at: futureExpiry } } }),
    getPathname: async () => "/command-center",
    getAuthCookieNames: async () => ["sb-project-auth-token"],
  });
  assert.equal(report.ok, true);
  assert.equal(report.networkError, true);
  assert.equal(report.userId, "user-5");
  assert.equal(report.user?.id, "user-5");
});

test("buildAuthUserContext: an email-less Supabase user maps to null (unchanged prior behavior)", () => {
  const authUser = buildAuthUserContext({ id: "user-6", email: null, user_metadata: {} });
  assert.equal(authUser, null);
});

test("buildAuthUserContext: maps metadata fields the same way getAuthUser previously did inline", () => {
  const authUser = buildAuthUserContext({
    id: "user-7",
    email: "person@example.com",
    user_metadata: { full_name: "Person Example", company_name: "Acme", role: "pm", onboarding_completed: true },
  });
  assert.ok(authUser);
  assert.equal(authUser.fullName, "Person Example");
  assert.equal(authUser.companyName, "Acme");
  assert.equal(authUser.role, "pm");
  assert.equal(authUser.onboardingCompleted, true);
});

test("buildAuthUserContext: role metadata can never smuggle owner/admin (unchanged prior behavior)", () => {
  const authUser = buildAuthUserContext({ id: "user-8", email: "x@example.com", user_metadata: { role: "owner" } });
  assert.ok(authUser);
  assert.equal(authUser.role, "viewer", "owner/admin must never be derivable from client-controlled metadata");
});
