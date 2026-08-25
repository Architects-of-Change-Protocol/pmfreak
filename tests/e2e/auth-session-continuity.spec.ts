/**
 * AUTH SESSION CONTINUITY — regression guard for the P2-14 prerequisite repair.
 *
 * The defect: Next.js prefetches `<Link>` targets entering the viewport. The operational
 * shell renders a "Sign out" link, so every protected page issued a real
 * `GET /logout?_rsc=...` carrying `Next-Router-Prefetch: 1` shortly after load. That
 * prefetch executed `signOut()` and returned
 * `Set-Cookie: sb-<ref>-auth-token=; Max-Age=0`, so simply LOOKING at a protected page
 * destroyed the session ~1-2s later. The next protected request answered 401 and the next
 * hard refresh bounced to /login.
 *
 * These are real browser assertions on purpose. Source scanning cannot prove session
 * continuity, and this defect was invisible to every static test in the repository —
 * the whole point is that it only appears when a real client prefetches.
 *
 * Nothing here re-authenticates after a refresh; that would prove the opposite of what is
 * being asserted. One sign-in per case, then the session must survive on its own.
 */

import { test, expect, type Page } from "@playwright/test";
import { TENANT_A, actor } from "./helpers/p2-14-scenario";
import { signIn, probeSummary } from "./helpers/p2-14-session";

const OWNER_A = actor(TENANT_A, "owner");

/** Comfortably beyond the window in which the prefetch used to destroy the session. */
const DWELL_MS = 8_000;

const AUTH_COOKIE = /^sb-.*-auth-token/;

/** Identity of the principal the SERVER resolves — never a client-side claim. */
async function serverPrincipal(page: Page): Promise<string> {
  const response = await page.request.get(
    `/api/operational-flow?workspaceId=${TENANT_A.workspaceId}&projectId=${TENANT_A.projectId}`
  );
  expect(response.status(), "authenticated summary read").toBe(200);
  const body = (await response.json()) as { actor?: { userId?: string } };
  return String(body.actor?.userId ?? "");
}

test.describe("authenticated session continuity", () => {
  // Three runs: the defect was deterministic once the prefetch fired, but repeating also
  // catches a partial fix that merely narrows the window instead of closing it.
  for (const run of [1, 2, 3]) {
    test(`session survives a dwell on a protected page and a hard refresh (run ${run})`, async ({ page, context }) => {
      await signIn(page, OWNER_A.email);
      const before = await serverPrincipal(page);
      expect(before, "authenticated principal resolved").not.toBe("");

      // Dwell on a protected page whose shell renders the sign-out link. This is the exact
      // condition that used to end the session.
      await page.goto("/dashboard");
      await page.waitForTimeout(DWELL_MS);

      const names = (await context.cookies()).map((cookie) => cookie.name);
      expect(names.some((name) => AUTH_COOKIE.test(name)), "auth cookie survived the dwell").toBe(true);
      expect(await serverPrincipal(page), "same principal after the dwell").toBe(before);

      await page.reload({ waitUntil: "domcontentloaded" });
      expect(page.url(), "hard refresh must not bounce to /login").not.toContain("/login");
      expect(await serverPrincipal(page), "same principal after the hard refresh").toBe(before);
    });
  }

  /**
   * Walk a GET by hand, one hop at a time, recording EVERY response.
   *
   * `maxRedirects: 0` cannot express this case. An RSC-flavoured GET does not reach the
   * route handler first: Next answers it with a FRAMEWORK-WIDE redirect that re-issues the
   * request under the RSC query key —
   *
   *     GET /logout   (RSC: 1)  ->  307, location: /logout?_rsc=<key>
   *     GET /logout?_rsc=<key>  ->  405, allow: POST
   *
   * That 307 belongs to Next's router, not to `/logout`; it is emitted for RSC requests
   * generally and is not a property this repository controls. Asserting 405 on hop 1 was
   * therefore asserting something Next 16.3.2 never promised, and the test failed on the
   * redirect rather than on any product behaviour (observed: expected 405, received 307).
   *
   * The security property is about the WHOLE CHAIN, not the first hop, so the chain is what
   * gets collected — and every response in it is then held to the contract. Following by
   * hand rather than with `maxRedirects: N` is deliberate: Playwright's own redirect
   * following would discard the intermediate responses, and those are exactly what must be
   * proven cookie-free.
   */
  async function followGet(
    page: Page,
    url: string,
    headers?: Record<string, string>
  ): Promise<Array<{ url: string; status: number; headers: Record<string, string> }>> {
    const chain: Array<{ url: string; status: number; headers: Record<string, string> }> = [];
    let next = url;
    // Bounded: a redirect LOOP on a sign-out endpoint is itself a defect, not something to
    // follow indefinitely.
    for (let hop = 0; hop < 5; hop += 1) {
      const response = await page.request.get(next, { headers, maxRedirects: 0 });
      chain.push({ url: next, status: response.status(), headers: response.headers() });
      if (response.status() < 300 || response.status() >= 400) return chain;
      const location = response.headers()["location"];
      expect(location, `redirect at hop ${hop} must name a target`).toBeTruthy();
      next = new URL(location, new URL(next, "http://localhost")).toString().replace("http://localhost", "");
    }
    throw new Error(`GET ${url} did not settle within 5 hops: ${JSON.stringify(chain)}`);
  }

  /** The cookie that carries the session. Clearing it IS the logout. */
  const clearsTheSession = (setCookie: string) =>
    AUTH_COOKIE.test(setCookie) && /max-age=0|expires=thu, 01 jan 1970/i.test(setCookie);

  // P2-15 moved sign-out from GET to POST. P2-14 had made the state-changing GET *safe* by
  // recognising speculative requests; this makes it *inert*, so a speculative request the
  // route fails to classify can no longer end a session at all.
  test("no GET of /logout ends the session — prefetch-flavoured or not", async ({ page, context }) => {
    await signIn(page, OWNER_A.email);
    const before = await serverPrincipal(page);

    // Exactly what the Next.js router sends when it prefetches the link, and a plain GET
    // carrying NO speculative signal at all — which under the pre-P2-15 contract WOULD have
    // signed the user out. The plain case is the one proving the repair no longer depends on
    // recognising the caller.
    const cases = [
      { label: "prefetch-flavoured GET", headers: { RSC: "1", "Next-Router-Prefetch": "1" } },
      { label: "ordinary GET", headers: undefined },
    ];

    for (const { label, headers } of cases) {
      const chain = await followGet(page, "/logout", headers);
      const final = chain[chain.length - 1];

      // 1. However many hops Next interposes, the destination is the refusal.
      expect(final.status, `${label}: settles at 405, sign-out not performed`).toBe(405);
      // 2. ...and it names the method that does perform the transition.
      expect(final.headers["allow"], `${label}: the answer names the method that does`).toContain("POST");

      // 3. THE SECURITY PROPERTY: no response anywhere in the chain may clear the session.
      //    Checked per hop, because a redirect can carry Set-Cookie just as a 200 can, and
      //    an intermediate hop is precisely where following-by-default would hide one.
      for (const [hop, response] of chain.entries()) {
        const setCookie = response.headers["set-cookie"] ?? "";
        expect(
          setCookie.split("\n").some(clearsTheSession),
          `${label}: hop ${hop} (${response.status} ${response.url}) must not emit a session-clearing cookie`
        ).toBe(false);
      }

      // 4. Only the prefetch case should ever have been redirected; record the shape so a
      //    future framework change that starts redirecting the plain GET is visible rather
      //    than silently absorbed.
      const redirects = chain.slice(0, -1).map((hop) => hop.status);
      expect(redirects.every((status) => status === 307 || status === 308), `${label}: only RSC redirects`).toBe(true);

      // 5. The session is intact on the client...
      const names = (await context.cookies()).map((cookie) => cookie.name);
      expect(names.some((name) => AUTH_COOKIE.test(name)), `${label}: auth cookie survived`).toBe(true);
      // 6. ...and, authoritatively, on the server.
      expect(await serverPrincipal(page), `${label}: principal unchanged`).toBe(before);
    }
  });

  // The complement of the case above: GET is inert, so POST must remain the one mechanism
  // that actually ends a session. Asserting only the refusal would be satisfied by a route
  // that had no working sign-out at all.
  test("POST /logout remains the only mechanism that ends a session", async ({ page }) => {
    await signIn(page, OWNER_A.email);
    const before = await serverPrincipal(page);

    // A POST announcing a speculative intent is refused without signing out — defence in
    // depth retained from P2-14, now on the method that actually mutates.
    const speculative = await page.request.post("/logout", {
      headers: { "Next-Router-Prefetch": "1" },
      maxRedirects: 0,
    });
    expect(speculative.status(), "a speculative POST must not sign out").toBe(204);
    expect(await serverPrincipal(page), "principal unchanged by a speculative POST").toBe(before);

    // No other method may mutate authentication either.
    for (const method of ["PUT", "DELETE", "PATCH"] as const) {
      const response = await page.request.fetch("/logout", { method, maxRedirects: 0 });
      expect(response.status(), `${method} /logout must be refused`).toBe(405);
    }
    expect(await serverPrincipal(page), "principal unchanged by non-POST methods").toBe(before);

    // And the genuine POST does end it — 303 so the browser follows with a GET.
    const signOut = await page.request.post("/logout", { maxRedirects: 0 });
    expect(signOut.status(), "a genuine POST signs out and redirects").toBe(303);
    expect(signOut.headers()["location"], "to the signed-out page").toContain("/login");
  });

  test("the shell's Sign out control signs the user out", async ({ page, context }) => {
    // The real user path: a form POST submitted by the button in the shell. Driven through
    // the UI rather than a synthesised request, so the control itself is proven — it was a
    // prefetchable <Link> until P2-15.
    await signIn(page, OWNER_A.email);
    await serverPrincipal(page);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 45_000 });

    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names.some((name) => AUTH_COOKIE.test(name)), "auth cookie cleared by real sign-out").toBe(false);

    const after = await probeSummary(page, TENANT_A.workspaceId, TENANT_A.projectId);
    expect(after.status, "signed-out principal is denied").toBe(401);
  });

  test("a logged-out browser is denied the protected route and the canonical API", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url(), "unauthenticated redirect").toContain("/login");

    const probe = await probeSummary(page, TENANT_A.workspaceId, TENANT_A.projectId);
    expect(probe.status, "unauthenticated canonical API").toBe(401);
  });
});
