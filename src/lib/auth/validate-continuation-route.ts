const BLOCKED_PREFIXES = ["/login", "/signup", "/auth", "/debug", "/api", "/_next"];
const ALLOWED_PREFIXES = ["/workspace", "/projects", "/dashboard", "/portfolio", "/upload", "/command-center", "/create-command-center", "/create-pmo", "/pmo"];

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

    return ALLOWED_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}
