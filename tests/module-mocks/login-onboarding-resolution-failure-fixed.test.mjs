/**
 * Companion to login-onboarding-resolution-failure-pre-fix.test.mjs — read
 * that file's header first for the full root-cause writeup. Separate
 * `node --test` file for the same process-isolation reason as every other
 * file under tests/module-mocks/.
 *
 * Exercises the real, unmodified `POST` export of
 * `src/app/api/login/route.ts` directly, with a real
 * `createSupabaseServerClient()`/cookie-adapter chain — only the true I/O
 * boundary is mocked (`next/headers`, `@supabase/ssr`, and, to
 * deterministically trigger the failure mode without a real database,
 * `resolveOnboardingState`/`resolveCanonicalWorkspace`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { makeCookieJar, mockModuleOptions } from "./release-gate-01-fake-supabase.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

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

test("FIXED: POST /api/login redirects with the session cookie intact even when resolveOnboardingState()/resolveCanonicalWorkspace() throws", async (t) => {
  const jar = makeCookieJar({ writesSucceed: true });
  t.mock.module("next/headers", mockModuleOptions({ cookies: async () => jar, headers: async () => ({ get: () => null }) }));
  t.mock.module("@supabase/ssr", mockModuleOptions({ createServerClient: makeSignInOnlyGoTrueFactory() }));
  t.mock.module("@/lib/workspaces/canonical-workspace-resolver", mockModuleOptions({
    resolveCanonicalWorkspace: async () => { throw new Error("simulated: service role env missing / DB unreachable"); },
  }));
  t.mock.module("@/lib/auth/resolve-onboarding-state", mockModuleOptions({ resolveOnboardingState: async () => "active" }));

  const { POST } = await import("../../src/app/api/login/route.ts");

  const body = new URLSearchParams({ email: "uat@example.com", password: "correct-password" });
  const request = new Request("https://preview.example.com/api/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const response = await POST(request);

  assert.ok(response.status >= 300 && response.status < 400, `expected a redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get("location")).pathname, "/projects/new", "falls back to the same safe destination used when onboarding state can't be determined at all");
  assert.equal(
    jar.getAll().find((c) => c.name === "sb-127-auth-token")?.value,
    "session-payload",
    "the session cookie survives the redirect response despite the onboarding-resolution failure",
  );
});
