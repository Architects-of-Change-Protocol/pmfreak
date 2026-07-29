/**
 * Companion to signup-onboarding-resolution-failure-pre-fix.test.mjs — read
 * that file's header first for the full root-cause writeup. Separate
 * `node --test` file for the same process-isolation reason as every other
 * file under tests/module-mocks/.
 *
 * Exercises the real, unmodified `signupAction` export of
 * `src/app/signup/actions.ts` directly, with a real
 * `createSupabaseServerClient()`/cookie-adapter chain and the real, also
 * unmocked `resolveCanonicalWorkspace()` (throws on its own without
 * `SUPABASE_SERVICE_ROLE_KEY`, deliberately left unset — same technique
 * as the login regression tests, and for the same reason: mocking a
 * `@/`-aliased internal module via `t.mock.module()` is not reliable in
 * CI the way a bare package specifier is).
 *
 * `signupAction` never returns normally — like every Server Action that
 * calls `redirect()`, it always exits via the NEXT_REDIRECT throw Next.js
 * uses to signal navigation. The destination is read from that thrown
 * error's `.digest`.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, mockModuleOptions, resolveMockTarget, makeSignUpAndGetUserGoTrueFactory } from "./release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

function buildSignupFormData({ email, password, fullName, companyName }) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  formData.set("fullName", fullName);
  formData.set("companyName", companyName);
  return formData;
}

test("FIXED: signupAction redirects to /projects/new with the session cookie intact even when resolveOnboardingState()/resolveCanonicalWorkspace() throws, and an independent follow-up request recognizes the session", async (t) => {
  const jar = makeCookieJar({ writesSucceed: true });
  t.mock.module(resolveMockTarget("next/headers"), mockModuleOptions({ cookies: async () => jar, headers: async () => ({ get: () => null }) }));
  t.mock.module(resolveMockTarget("@supabase/ssr"), mockModuleOptions({
    createServerClient: makeSignUpAndGetUserGoTrueFactory({ email: "newuser@example.com", password: "correct-password", userId: "user-new-1" }),
  }));

  const { signupAction } = await import("../../src/app/signup/actions.ts");

  const formData = buildSignupFormData({ email: "newuser@example.com", password: "correct-password", fullName: "New User", companyName: "Acme" });

  await assert.rejects(
    () => signupAction(formData),
    (err) => {
      assert.match(err.digest ?? "", /^NEXT_REDIRECT;replace;\/projects\/new(?:;|$)/, `expected a redirect to /projects/new, got digest: ${err.digest}`);
      return true;
    },
    "signupAction must still redirect (not throw uncaught) despite the onboarding-resolution failure",
  );

  assert.equal(
    jar.getAll().find((c) => c.name === "sb-signup-auth-token")?.value,
    "signup-session-payload",
    "the session cookie survives the redirect despite the onboarding-resolution failure",
  );

  // Requirement: the immediately following, fully independent server
  // request must recognize the session signUp established — not just that
  // the cookie is present in the jar, but that real, unmodified server-side
  // auth-reading code (getAuthUser(), via /api/debug-auth's real GET
  // handler) accepts it.
  const { GET } = await import("../../src/app/api/debug-auth/route.ts");
  const response = await GET();
  const body = await response.json();
  assert.equal(response.status, 200, "the follow-up request must not be blocked (e.g. by the production-only debug gate)");
  assert.equal(body.authenticated, true, "a fresh, independent request presenting only the signup-issued cookie must be recognized as authenticated");
  assert.equal(body.user?.id, "user-new-1");
});
