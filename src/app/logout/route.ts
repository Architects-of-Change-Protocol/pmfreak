import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Sign-out is a DESTRUCTIVE transition, so it is a POST. GET never mutates authentication.
 *
 * The original defect (P2-14): Next.js prefetches `<Link>` targets as they enter the
 * viewport, issuing a real `GET /logout?_rsc=...` carrying `Next-Router-Prefetch: 1`.
 * That prefetch executed `signOut()` and emitted
 * `Set-Cookie: sb-<ref>-auth-token=; Max-Age=0`, so merely RENDERING any page whose shell
 * contained the sign-out link destroyed the visitor's session a second or two after load.
 * The next protected request answered 401 and the next hard refresh bounced to /login.
 *
 * P2-14 closed that with a header-sniffing guard: recognise a speculative request and
 * answer 204 without signing out. It worked, but it left the real problem standing — a
 * state-changing GET. Its safety depended on correctly identifying every speculative GET,
 * forever, across every prefetching agent, crawler, link-preview fetcher, security scanner
 * and browser that may or may not send a header this route knows about. The guard had
 * already needed one widening: `Next-Router-Prefetch` turned out to be an enum rather than
 * a boolean, so a check pinned to `"1"` would have missed the PPR strategy's `2`.
 *
 * P2-15 removes the dependence on that identification. GET performs no session mutation AT
 * ALL, so no request this route fails to classify can end a session — the speculative case
 * is closed structurally rather than by recognition. Sign-out happens only on POST, which
 * browsers, prefetchers and crawlers do not issue speculatively.
 *
 * The prefetch guard is retained on POST as defence in depth: an agent that announces a
 * speculative intent must never be honoured for a destructive transition, whatever method
 * it arrives under.
 */
const isSpeculativePrefetch = (request: Request) => {
  const header = (name: string) => request.headers.get(name) ?? "";
  // PRESENCE, not one exact value. `Next-Router-Prefetch` is an enum of fetch strategies,
  // not a boolean: Next 16.2.10 sends `1` for the classic and loading-boundary prefetches
  // and `2` for the segment cache's PPR runtime strategy, and the set is free to grow. The
  // header appearing at all means the request is speculative, whatever produced it.
  return request.headers.has("next-router-prefetch")
    || /\bprefetch\b/i.test(header("purpose"))
    || /\bprefetch\b/i.test(header("sec-purpose"));
};

/**
 * A GET must be safe, so this one is inert.
 *
 * 405 rather than a redirect to /login: redirecting would show the visitor the signed-out
 * page while their session is still live, reporting a sign-out that did not happen. The
 * honest answer is that this method does not perform the transition, and `Allow` names the
 * one that does.
 */
export async function GET() {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "POST",
      // Never cache an answer for /logout, not even this refusal — a cached entry is
      // exactly what could later stand in for a real sign-out attempt.
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (isSpeculativePrefetch(request)) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  if (hasSupabaseEnv) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  // 303, so the browser follows with a GET rather than re-submitting the POST — the
  // standard answer to a form submission that succeeded and has somewhere to send you.
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  // The credential-clearing Set-Cookie must reach this browser on this request.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
