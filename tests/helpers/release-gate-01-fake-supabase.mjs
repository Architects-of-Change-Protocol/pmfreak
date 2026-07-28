/**
 * Shared fakes for the release-gate-01 production-entry-point regression
 * tests (tests/release-gate-01-*-pattern.test.mjs). Each of those files runs
 * in its own `node --test` child process, so module-level mock state here
 * never leaks between them — see the comment in those files for why that
 * process boundary matters (it's what makes each file's `t.mock.module`
 * calls actually take effect on `src/lib/supabase/server.ts`'s already-
 * cached `@supabase/ssr` import).
 */

// A real Next.js `cookies()` store, minimally reimplemented: `getAll()` plus
// a `set()` that either persists (Server Action / Route Handler / real
// middleware) or throws exactly as Next does in a Server Component render
// ("Cookies can only be modified in a Server Action or Route Handler"),
// which is what `createSupabaseServerClient`'s setAll try/catch is written
// to swallow.
export function makeCookieJar({ writesSucceed }) {
  const store = new Map();
  return {
    seed(name, value) {
      store.set(name, value);
    },
    getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
    set: (name, value) => {
      if (!writesSucceed) {
        throw new Error("Cookies can only be modified in a Server Action or Route Handler");
      }
      store.set(name, value);
    },
  };
}

// Models the GoTrue HTTP client `@supabase/ssr`'s createServerClient hands
// back: single-use refresh tokens, an on-demand refresh on an expired access
// token, and (faithfully to real Supabase/GoTrue) the refresh call itself
// still succeeds even when the caller fails to persist the replacement —
// the corrupted state only surfaces on the NEXT call that presents the
// now-already-consumed refresh token.
export function makeFakeGoTrueFactory() {
  const consumedRefreshTokens = new Set();
  return function createServerClient(_url, _anonKey, { cookies }) {
    return {
      auth: {
        getUser: async () => {
          const refreshCookie = cookies.getAll().find((c) => c.name === "sb-refresh-token");
          const accessCookie = cookies.getAll().find((c) => c.name === "sb-access-token");
          const currentRefresh = refreshCookie?.value;
          const accessExpired = accessCookie?.value?.endsWith("-expired");

          if (!accessExpired) {
            return { data: { user: { id: "user-1", email: "uat@example.com", user_metadata: {} } }, error: null };
          }
          if (consumedRefreshTokens.has(currentRefresh)) {
            return { data: { user: null }, error: { status: 401, message: "Invalid Refresh Token: Already Used" } };
          }
          consumedRefreshTokens.add(currentRefresh);
          const nextRefresh = `${currentRefresh}-next`;
          try {
            cookies.set("sb-refresh-token", nextRefresh);
            cookies.set("sb-access-token", `access-for-${nextRefresh}`);
          } catch {
            // Real createSupabaseServerClient's setAll swallows this
            // ("Server Components can read cookies, but may not be allowed
            // to write them"). The in-flight call still succeeds — that's
            // the hazard: the caller walks away believing it's fine while
            // the persisted refresh token is now stale.
          }
          return { data: { user: { id: "user-1", email: "uat@example.com", user_metadata: {} } }, error: null };
        },
        getSession: async () => ({ data: { session: null } }),
      },
    };
  };
}
