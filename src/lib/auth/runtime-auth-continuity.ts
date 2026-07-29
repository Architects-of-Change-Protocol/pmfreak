import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logContinuityIssue } from "@/lib/auth/auth-continuity-diagnostics";
import { cookies, headers } from "next/headers";
import type { MinimalSupabaseUser } from "@/lib/auth";

export type RuntimeAuthContinuityReport = {
  ok: boolean;
  userId: string | null;
  // The resolved auth user, when ok. Callers (e.g. (protected)/layout.tsx)
  // must build any further AuthUserContext directly from this instead of
  // making a second, independent getUser() call for the same request — see
  // buildAuthUserContext's doc comment in src/lib/auth.ts for why a second
  // call is unsafe, not just wasteful.
  user: MinimalSupabaseUser | null;
  expired: boolean;
  networkError: boolean;
  issues: string[];
};

type GetUserResult = { data: { user: MinimalSupabaseUser | null }; error: { message?: string; status?: number } | null };
type GetSessionResult = { data: { session: { user: MinimalSupabaseUser; expires_at?: number | null } | null } };

// Every dependency this function actually uses, individually injectable.
// Real callers pass nothing and get the real Next.js/Supabase-backed
// implementations; tests inject fakes so this logic — including the
// getUser()/getSession() call count, which is the exact seam the
// release-gate-01 auth-session-persistence defect lives in — can be
// exercised with real function invocations, without a Next.js request scope.
export type RuntimeAuthContinuityDeps = {
  getUser: () => Promise<GetUserResult>;
  getSession: () => Promise<GetSessionResult>;
  getPathname: () => Promise<string>;
  getAuthCookieNames: () => Promise<string[]>;
};

const realDeps = (): RuntimeAuthContinuityDeps => ({
  getUser: async () => {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.getUser();
  },
  getSession: async () => {
    const supabase = await createSupabaseServerClient();
    return supabase.auth.getSession();
  },
  getPathname: async () => {
    const headersList = await headers();
    return headersList.get("x-pathname") ?? "(unknown)";
  },
  getAuthCookieNames: async () => {
    const cookieStore = await cookies();
    return cookieStore
      .getAll()
      .filter((c) => c.name.startsWith("sb-") || c.name.includes("supabase") || c.name.includes("auth"))
      .map((c) => c.name);
  },
});

export async function assertRuntimeAuthContinuity(deps?: Partial<RuntimeAuthContinuityDeps>): Promise<RuntimeAuthContinuityReport> {
  const real = realDeps();
  const { getUser, getSession, getPathname, getAuthCookieNames } = { ...real, ...deps };

  const pathname = await getPathname();
  const authCookieNames = await getAuthCookieNames();
  console.log("[auth-continuity] pathname:", pathname);
  console.log("[auth-continuity] auth-related cookies present:", authCookieNames.length > 0 ? authCookieNames : "(none)");

  // getUser() validates the JWT against Supabase's server (authoritative).
  // Unlike getSession(), it does not silently pass expired tokens. This is
  // the ONLY getUser() call for a given request — (protected)/layout.tsx
  // must build the full AuthUserContext from the `user` this returns
  // instead of calling getAuthUser()/requireAuthUser() again afterward.
  const { data: { user }, error } = await getUser();

  console.log("[auth-continuity] getUser result:", user ? `userId=${user.id}` : `null (error: ${error?.message ?? "none"}, status: ${error?.status ?? "n/a"})`);

  if (user) {
    return { ok: true, userId: user.id, user, expired: false, networkError: false, issues: [] };
  }

  // Distinguish a genuine auth failure (401/403) from a transient network or API
  // error. For network errors, fall back to getSession() to avoid bouncing an
  // authenticated user to /login when Supabase has a momentary hiccup.
  const errorStatus = error?.status;
  const isAuthRejection = errorStatus === 401 || errorStatus === 403;
  const isNetworkError = !isAuthRejection && Boolean(error);

  if (isNetworkError) {
    console.log("[auth-continuity] getUser returned a non-auth error; falling back to getSession()");
    const { data: { session } } = await getSession();
    const sessionExpiresAt = session?.expires_at ?? 0;
    const sessionValid = Boolean(session?.user) && sessionExpiresAt * 1000 > Date.now();
    console.log("[auth-continuity] getSession fallback:", sessionValid ? `userId=${session!.user.id}` : "no valid session");

    if (sessionValid) {
      logContinuityIssue(
        "auth",
        { code: "getuser_network_error_session_fallback", severity: "warn", message: error?.message ?? "getUser failed, session fallback used" },
        { pathname, errorStatus }
      );
      return { ok: true, userId: session!.user.id, user: session!.user, expired: false, networkError: true, issues: ["getuser_network_error"] };
    }
  }

  const issue = isAuthRejection ? "auth_rejected" : "missing_session";
  logContinuityIssue(
    "auth",
    { code: issue, severity: "warn", message: error?.message ?? "No authenticated user" },
    { pathname, errorStatus }
  );
  return { ok: false, userId: null, user: null, expired: true, networkError: false, issues: [issue] };
}
