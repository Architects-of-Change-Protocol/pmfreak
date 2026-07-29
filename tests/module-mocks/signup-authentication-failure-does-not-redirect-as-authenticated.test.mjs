/**
 * Companion coverage to the signup-onboarding-resolution-failure-*.test.mjs
 * files. Those prove a POST-authentication failure (onboarding-destination
 * resolution) can never destroy an already-successful signup. This file
 * proves the opposite boundary holds too: a genuine signUp() AUTHENTICATION
 * failure (invalid credentials) must still fail — the fix in
 * src/app/signup/actions.ts only wraps the onboarding-resolution call,
 * strictly after the `if (error) redirect(...)` check, so it must have no
 * effect on this path at all.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, mockModuleOptions, resolveMockTarget } from "./release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

function makeRejectingGoTrueFactory() {
  return function createServerClient() {
    return {
      auth: {
        signUp: async () => ({
          data: { user: null, session: null },
          error: { message: "User already registered", status: 422 },
        }),
      },
    };
  };
}

function buildSignupFormData({ email, password, fullName, companyName }) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  formData.set("fullName", fullName);
  formData.set("companyName", companyName);
  return formData;
}

test("genuine signUp() failure redirects to /signup with an error, never to an authenticated destination, and writes no session cookie", async (t) => {
  const jar = makeCookieJar({ writesSucceed: true });
  t.mock.module(resolveMockTarget("next/headers"), mockModuleOptions({ cookies: async () => jar, headers: async () => ({ get: () => null }) }));
  t.mock.module(resolveMockTarget("@supabase/ssr"), mockModuleOptions({ createServerClient: makeRejectingGoTrueFactory() }));

  const { signupAction } = await import("../../src/app/signup/actions.ts");
  const formData = buildSignupFormData({ email: "already-taken@example.com", password: "correct-password", fullName: "New User", companyName: "Acme" });

  await assert.rejects(
    () => signupAction(formData),
    (err) => {
      const digest = err.digest ?? "";
      assert.match(digest, /^NEXT_REDIRECT;replace;\/signup\?error=/, `expected a redirect back to /signup with an error, got digest: ${digest}`);
      assert.doesNotMatch(digest, /\/projects\/new|\/command-center/, "a genuine auth failure must never land on an authenticated destination");
      return true;
    },
    "signUp() returning an error must redirect to /signup?error=..., not proceed to onboarding resolution or an authenticated destination",
  );

  assert.equal(jar.getAll().length, 0, "no session cookie may be written when signUp() itself fails");
});
