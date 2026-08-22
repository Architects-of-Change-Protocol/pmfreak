export type RouteAccessPolicy =
  | "public"
  | "auth"
  | "setup"
  | "workspace-core"
  | "workspace-contextual"
  | "internal-debug"
  | "api"
  | "unknown";

const matchesRoute = (pathname: string, route: string): boolean => pathname === route || pathname.startsWith(`${route}/`);

const matchesAnyRoute = (pathname: string, routes: readonly string[]): boolean => routes.some((route) => matchesRoute(pathname, route));

const AUTH_ROUTES = ["/login", "/signup"] as const;
// Retired legacy onboarding entry points. Each now renders nothing but a
// redirect to the derived canonical destination (resolveOnboardingState) —
// kept in the route table only so bookmarked URLs remain protected pages
// instead of falling through to "unknown".
const SETUP_ROUTES = ["/workspace/setup", "/getting-started", "/onboarding"] as const;
const WORKSPACE_CORE_ROUTES = [
  "/workspace",
  "/copilot",
  "/projects",
  "/upload",
  "/accept-invite",
  "/create-command-center",
  "/create-pmo",
] as const;
const WORKSPACE_CONTEXTUAL_ROUTES = [
  "/dashboard",
  "/command-center",
  "/workspaces",
  "/pmos",
  "/chat",
  "/execution",
  "/workspace-setup",
  "/programs",
  "/portfolio",
  "/executive",
  "/stakeholder-intel",
  "/meetings",
  "/follow-up-dashboard",
  "/input-hub",
  "/operational-memory",
  "/change-detection",
  "/project-memory",
  "/intelligence",
  "/governance",
  "/trust",
  "/capabilities",
  "/policies",
  "/audit",
  "/billing",
  "/team",
  "/playground",
  "/message-nudges",
  "/political-risk",
  "/escalation-guide",
  "/early-access",
  "/trial-inactive",
  "/pm-registry",
  "/pmo-interventions",
  "/pmo-executive-reporting",
  "/trials",
  "/evidence",
] as const;
const INTERNAL_DEBUG_ROUTES = ["/debug-session"] as const;
const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/forgot-password",
  "/auth/reset-password",
  "/auth/callback",
  "/signup/confirm-email",
  "/logout",
] as const;

export function getRouteAccessPolicy(pathname: string): RouteAccessPolicy {
  if (matchesRoute(pathname, "/api")) {
    return "api";
  }

  if (matchesAnyRoute(pathname, INTERNAL_DEBUG_ROUTES)) {
    return "internal-debug";
  }

  if (matchesAnyRoute(pathname, AUTH_ROUTES)) {
    return "auth";
  }

  if (matchesAnyRoute(pathname, SETUP_ROUTES)) {
    return "setup";
  }

  if (matchesAnyRoute(pathname, WORKSPACE_CORE_ROUTES)) {
    return "workspace-core";
  }

  if (matchesAnyRoute(pathname, WORKSPACE_CONTEXTUAL_ROUTES)) {
    return "workspace-contextual";
  }

  if (matchesAnyRoute(pathname, PUBLIC_ROUTES)) {
    return "public";
  }

  return "unknown";
}

export function isProtectedPageRoute(pathname: string): boolean {
  const policy = getRouteAccessPolicy(pathname);
  return (
    policy === "setup" ||
    policy === "workspace-core" ||
    policy === "workspace-contextual" ||
    policy === "internal-debug" ||
    policy === "unknown"
  );
}

export function isAuthRoute(pathname: string): boolean {
  return getRouteAccessPolicy(pathname) === "auth";
}

export function isInternalDebugRoute(pathname: string): boolean {
  return getRouteAccessPolicy(pathname) === "internal-debug";
}
