/**
 * A different, separate defect from release-gate-01: discovered while
 * investigating a preview-UAT report that /projects/new rendered a fully
 * authenticated shell (matching the account and role) immediately before
 * /api/debug-auth reported no server-readable session and DevTools showed
 * zero sb-* cookies for the preview domain — despite the release-gate-01
 * fix (single getUser() call per protected-route request) already being
 * deployed.
 *
 * Root cause, confirmed against the real Next.js request/response contract
 * (not a mock assumption): `src/app/api/login/route.ts`'s POST handler
 * calls `supabase.auth.signInWithPassword()`, which queues a session-cookie
 * write via the request's `cookies()` adapter — then, before returning,
 * calls `resolveOnboardingState()`/`resolveCanonicalWorkspace()` to pick a
 * post-login destination. If EITHER of those throws, the handler exits via
 * an uncaught exception instead of `return NextResponse.redirect(...)`.
 *
 * Verified directly against a real `next dev` server (Next.js 16.2.10) with
 * a real `/api/login`-shaped route and a fake GoTrue backend: when nothing
 * throws, `cookies().set()` mutations DO correctly merge onto a returned
 * `NextResponse.redirect()`'s Set-Cookie header (ruling out a general
 * Next.js redirect-drops-cookies theory) — but when something throws
 * between the cookie write and the return statement, Next.js's own
 * generated error response carries NO Set-Cookie header at all: the
 * already-established, genuinely valid session is silently discarded.
 * `resolveCanonicalWorkspace`/`resolveOnboardingState` are only used to
 * pick which authenticated page to land on — never to establish or
 * validate the auth session itself — so a failure in either of them
 * destroying an otherwise-successful login is never correct.
 *
 * This is a separate `node --test` file from
 * login-onboarding-resolution-failure-fixed.test.mjs for the same reason
 * every other file under tests/module-mocks/ is split: `node --test` runs
 * each file in its own child process, and `t.mock.module()`'s effect on a
 * module that a PRIOR test in the same process already imported (and
 * therefore already resolved/cached) does not apply retroactively.
 *
 * `resolveCanonicalWorkspace` is used real and unmocked here — it throws on
 * its own via `createSupabaseServiceRoleClient()` when
 * `SUPABASE_SERVICE_ROLE_KEY` isn't set (deliberately left unset), which is
 * both a faithful, real reproduction (this is the exact failure verified
 * live against a running `next dev` server — see the audit doc) and avoids
 * `t.mock.module()` targeting a `@/`-aliased internal module — unlike bare
 * package specifiers such as `next/headers`, `import.meta.resolve()` does
 * not reliably route those through tsx's path-alias resolution in CI, in a
 * way not reproducible locally.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, mockModuleOptions, resolveMockTarget } from "./release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

// Models signInWithPassword succeeding and writing a session cookie via the
// route handler's real cookies() adapter — Route Handlers CAN persist
// writes (unlike a plain Server Component render), so this jar accepts them.
function makeSignInOnlyGoTrueFactory() {
  return function createServerClient(_url, _anonKey, { cookies }) {
    return {
      auth: {
        signInWithPassword: async ({ email, password }) => {
          if (email !== "uat@example.com" || password !== "correct-password") {
            return { data: { user: null, session: null }, error: { message: "Invalid login credentials", status: 400 } };
          }
          cookies.setAll([{ name: "sb-127-auth-token", value: "session-payload", options: { path: "/" } }]);
          return {
            data: { user: { id: "user-1", email, user_metadata: {} }, session: { access_token: "access-1" } },
            error: null,
          };
        },
      },
    };
  };
}

test("PRE-FIX-STYLE FAILURE: an uncaught resolveOnboardingState()/resolveCanonicalWorkspace() error after a successful sign-in destroys the just-written session cookie", async (t) => {
  const jar = makeCookieJar({ writesSucceed: true }); // Route Handler context: writes succeed
  t.mock.module(resolveMockTarget("next/headers"), mockModuleOptions({ cookies: async () => jar, headers: async () => ({ get: () => null }) }));
  t.mock.module(resolveMockTarget("@supabase/ssr"), mockModuleOptions({ createServerClient: makeSignInOnlyGoTrueFactory() }));

  // The exact unguarded call sequence that was live in
  // src/app/api/login/route.ts on origin/main and every commit of this PR
  // before the fix: signIn, then an un-guarded
  // resolveOnboardingState(await resolveCanonicalWorkspace(...)).
  const { createSupabaseServerClient } = await import("../../src/lib/supabase/server.ts");
  const { resolveCanonicalWorkspace } = await import("../../src/lib/workspaces/canonical-workspace-resolver.ts");
  const { resolveOnboardingState } = await import("../../src/lib/auth/resolve-onboarding-state.ts");

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email: "uat@example.com", password: "correct-password" });
  assert.equal(error, null, "sign-in itself must succeed for this scenario");
  assert.equal(jar.getAll().find((c) => c.name === "sb-127-auth-token")?.value, "session-payload", "sign-in must have written the session cookie");

  const authUser = { id: data.user.id, email: data.user.email };
  await assert.rejects(
    async () => {
      // Byte-for-byte the pre-fix call shape: resolveCanonicalWorkspace is
      // awaited FIRST, inline, before resolveOnboardingState is even called.
      await resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(authUser.id)).workspaceId);
    },
    /Missing Supabase service role environment variables/,
    "this is the exact unguarded call shape that was live in src/app/api/login/route.ts — it throws uncaught",
  );
  // The real, live Next.js contract (verified separately against a running
  // `next dev` server, not assumed here): a route handler that exits via an
  // uncaught exception after cookies().set() never gets those mutations
  // merged onto Next's own generated error response — the cookie above is
  // real and present in THIS jar, but on origin/main nothing downstream of
  // this throw ever runs, so no response carrying it is ever returned to
  // the browser at all.
});
