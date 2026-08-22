import { getRouteAccessPolicy, isProtectedPageRoute } from "@/lib/auth/route-policy-registry";

const BLOCKED_PREFIXES = ["/login", "/signup", "/auth", "/debug", "/api", "/_next"];

// Deliberately delegates "is this a route we should send an authenticated
// user back to" to the same canonical route table isProtectedPageRoute uses
// (src/lib/auth/route-policy-registry.ts), instead of maintaining a second,
// independent allowlist here. A hand-maintained duplicate (the previous
// ALLOWED_PREFIXES) silently drifted out of sync with the real, growing set
// of protected routes/nav destinations (e.g. /chat, /execution, /executive,
// /pmos, /workspaces, /team were all missing) — any route missing from that
// list caused a post-login redirect to silently discard the user's actual
// requested destination even though the route itself was perfectly safe to
// return to. BLOCKED_PREFIXES stays as an explicit belt-and-suspenders
// denylist for auth/api/debug routes, which isProtectedPageRoute already
// excludes on its own.
export function isSafeContinuationRoute(route: string): boolean {
  if (typeof route !== "string") return false;
  // Check control characters before trimming so they cannot be hidden by whitespace stripping.
  if (/[\r\n\t]/.test(route)) return false;
  const normalized = route.trim();
  if (!normalized.startsWith("/")) return false;
  if (normalized.startsWith("//")) return false;

  try {
    const parsed = new URL(normalized, "http://localhost");
    if (parsed.origin !== "http://localhost") return false;
    if (parsed.pathname !== normalized.split("?")[0]?.split("#")[0]) return false;

    if (BLOCKED_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) {
      return false;
    }

    // internal-debug routes (e.g. /debug-session) are "protected" in the
    // sense that isProtectedPageRoute requires auth to view them, but they
    // are internal tooling, not a real app destination a user should be
    // returned to after login — exclude them explicitly rather than relying
    // on BLOCKED_PREFIXES's "/debug" entry, which does not actually match
    // the real route literal "/debug-session" (no separating slash).
    if (getRouteAccessPolicy(parsed.pathname) === "internal-debug") {
      return false;
    }

    return isProtectedPageRoute(parsed.pathname);
  } catch {
    return false;
  }
}
