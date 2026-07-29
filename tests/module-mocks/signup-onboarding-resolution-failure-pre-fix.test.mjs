/**
 * `src/app/signup/actions.ts`'s `signupAction` Server Action has the
 * identical unguarded shape §13a of
 * docs/audits/remediation/release-gate-01-auth-session-persistence.md
 * fixed in `src/app/api/login/route.ts`: `signUp()` succeeds and queues
 * the session cookie via the request's `cookies()` adapter, then, before
 * the function's own `redirect(decision.destination)` call, an unguarded
 * `resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(...)).workspaceId)`
 * runs. If either throws, the Server Action exits via an uncaught
 * exception instead of ever calling `redirect(...)` — discarding the
 * just-established, genuinely valid signup session.
 *
 * This file documents that pre-fix failure against the real, unmodified
 * dependency chain — `resolveCanonicalWorkspace` throws on its own via
 * `createSupabaseServiceRoleClient()` when `SUPABASE_SERVICE_ROLE_KEY`
 * isn't set (deliberately left unset here), the same real failure mode
 * verified live for the login route. See
 * signup-onboarding-resolution-failure-fixed.test.mjs (a separate
 * `node --test` file, for the same process-isolation reason as every file
 * under tests/module-mocks/) for the corrected behavior.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, mockModuleOptions, resolveMockTarget, makeSignUpAndGetUserGoTrueFactory } from "./release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

test("PRE-FIX-STYLE FAILURE: an uncaught resolveOnboardingState()/resolveCanonicalWorkspace() error after a successful signUp destroys the just-written session cookie", async (t) => {
  const jar = makeCookieJar({ writesSucceed: true }); // Server Action context: writes succeed
  t.mock.module(resolveMockTarget("next/headers"), mockModuleOptions({ cookies: async () => jar, headers: async () => ({ get: () => null }) }));
  t.mock.module(resolveMockTarget("@supabase/ssr"), mockModuleOptions({
    createServerClient: makeSignUpAndGetUserGoTrueFactory({ email: "newuser@example.com", password: "correct-password", userId: "user-new-1" }),
  }));

  // The exact unguarded call sequence live in src/app/signup/actions.ts on
  // origin/main and every prior commit of this PR: signUp, then an
  // un-guarded resolveOnboardingState(await resolveCanonicalWorkspace(...)).
  const { createSupabaseServerClient } = await import("../../src/lib/supabase/server.ts");
  const { resolveCanonicalWorkspace } = await import("../../src/lib/workspaces/canonical-workspace-resolver.ts");
  const { resolveOnboardingState } = await import("../../src/lib/auth/resolve-onboarding-state.ts");

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signUp({ email: "newuser@example.com", password: "correct-password" });
  assert.equal(error, null, "signUp itself must succeed for this scenario");
  assert.ok(data.session, "a successful signUp in this scenario returns a session immediately (no email-confirmation gate)");
  assert.equal(jar.getAll().find((c) => c.name === "sb-signup-auth-token")?.value, "signup-session-payload", "signUp must have written the session cookie");

  const authUser = { id: data.user.id, email: data.user.email };
  await assert.rejects(
    async () => {
      // Byte-for-byte the pre-fix call shape: resolveCanonicalWorkspace is
      // awaited FIRST, inline, before resolveOnboardingState is even called.
      await resolveOnboardingState(authUser, (await resolveCanonicalWorkspace(authUser.id)).workspaceId);
    },
    /Missing Supabase service role environment variables/,
    "this is the exact unguarded call shape that was live in src/app/signup/actions.ts — it throws uncaught",
  );
  // The real, live Next.js contract this models (verified against a
  // running `next dev` server for the login route — see the audit doc): a
  // Server Action that exits via an uncaught exception after cookies.set()
  // never gets those mutations merged onto any response — the cookie above
  // is real and present in THIS jar, but on origin/main nothing downstream
  // of this throw ever runs, so redirect() is never even called.
});
