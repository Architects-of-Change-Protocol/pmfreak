import { getAuthUser } from "@/lib/auth";
import { isProductionRuntime } from "@/lib/security/environment";

// Dev-only helper for /debug-session (the page itself is already blocked in
// production by src/proxy.ts's isInternalDebugRoute check — this route lives
// under /api, which the proxy passes through unconditionally, so it needs
// its own production gate). See docs/security/production-deployment-boundary.md.
export async function GET() {
  if (isProductionRuntime()) {
    return new Response(null, { status: 404 });
  }

  const user = await getAuthUser();

  return Response.json({
    authenticated: Boolean(user),
    user: user
      ? {
          id: user.id,
          email: user.email,
          companyId: user.companyId,
          role: user.role,
        }
      : null,
  });
}
