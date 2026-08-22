import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Sign-out is a DESTRUCTIVE transition, so it must never run for a request the client
 * issued speculatively.
 *
 * Next.js prefetches `<Link>` targets as they enter the viewport, issuing a real
 * `GET /logout?_rsc=...` carrying `Next-Router-Prefetch: 1`. That prefetch executed
 * `signOut()` and emitted `Set-Cookie: sb-<ref>-auth-token=; Max-Age=0`, so merely
 * RENDERING any page whose shell contains the sign-out link destroyed the visitor's
 * session a second or two after load. The next protected request answered 401 and the
 * next hard refresh bounced to /login, which is exactly the continuity defect P2-14's
 * browser story surfaced at its hard-refresh checkpoint.
 *
 * A prefetch is by definition speculative and must be side-effect free, so it is answered
 * with 204 and no session change. This is NOT a weakening of sign-out: a real navigation
 * — a click — carries no prefetch header and still signs the user out in full. The guard
 * lives server-side on purpose, so it holds for every prefetching agent rather than only
 * the one link that exposed the defect.
 *
 * 204 rather than the redirect, deliberately: letting a prefetch cache a /logout -> /login
 * redirect would let a later real click land on /login WITHOUT the session ever being
 * cleared, which would be a genuine weakening.
 */
const isSpeculativePrefetch = (request: Request) => {
  const header = (name: string) => request.headers.get(name) ?? "";
  // PRESENCE, not one exact value. `Next-Router-Prefetch` is an enum of fetch strategies,
  // not a boolean: Next 16.2.10 sends `1` for the classic and loading-boundary prefetches
  // and `2` for the segment cache's PPR runtime strategy, and the set is free to grow. A
  // guard pinned to `"1"` would silently stop recognising a prefetch the moment PPR is
  // enabled and let the destructive branch run again — the exact defect this route
  // repairs. The header appearing at all means the request is speculative, whatever
  // strategy produced it.
  return request.headers.has("next-router-prefetch")
    || /\bprefetch\b/i.test(header("purpose"))
    || /\bprefetch\b/i.test(header("sec-purpose"));
};

export async function GET(request: Request) {
  if (isSpeculativePrefetch(request)) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  if (hasSupabaseEnv) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  // A sign-out response must never be reused from a cache; the whole point is that the
  // credential-clearing Set-Cookie reaches this browser on this request.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
