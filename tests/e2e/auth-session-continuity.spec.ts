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

  test("a speculative prefetch of /logout does not end the session", async ({ page }) => {
    await signIn(page, OWNER_A.email);
    const before = await serverPrincipal(page);

    // Exactly what the Next.js router sends when it prefetches the link.
    const prefetch = await page.request.get("/logout", {
      headers: { RSC: "1", "Next-Router-Prefetch": "1" },
      maxRedirects: 0,
    });
    // Answered, but with no content and no session change.
    expect(prefetch.status(), "prefetch answered without performing sign-out").toBe(204);
    expect(await serverPrincipal(page), "principal unchanged by the prefetch").toBe(before);
  });

  test("a real navigation to /logout still signs the user out", async ({ page, context }) => {
    // The guard must not weaken sign-out: a click carries no prefetch header.
    await signIn(page, OWNER_A.email);
    await serverPrincipal(page);

    await page.goto("/logout");
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
